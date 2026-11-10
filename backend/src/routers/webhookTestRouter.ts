import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

const router = Router();

// In-memory storage for received webhooks (for testing)
interface ReceivedWebhook {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: any;
  signature?: string;
  signatureValid?: boolean;
  query: Record<string, string>;
}

const receivedWebhooks: ReceivedWebhook[] = [];
const MAX_STORED_WEBHOOKS = 100; // Keep last 100 webhooks

/**
 * @swagger
 * /api/webhook-test/listen:
 *   post:
 *     summary: Webhook test listener endpoint
 *     description: Receives webhook calls and logs them for testing purposes. This endpoint accepts any POST request and stores the payload, headers, and signature for inspection.
 *     tags: [Webhooks - Testing]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Any JSON payload
 *     responses:
 *       200:
 *         description: Webhook received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Webhook received
 *                 webhookId:
 *                   type: string
 *                   description: ID of the stored webhook
 */
router.post('/listen', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string || 
                     req.headers['x-signature'] as string ||
                     req.headers['signature'] as string;

    const eventId = req.headers['x-webhook-event-id'] as string;
    const ackRequired = req.headers['x-webhook-acknowledgement-required'] === 'true';
    const ackUrl = req.headers['x-webhook-acknowledgement-url'] as string;

    // Verify signature if secret is provided in query or header
    let signatureValid: boolean | undefined;
    const secret = req.query.secret as string || req.headers['x-webhook-secret'] as string;
    
    if (signature && secret) {
      try {
        // Common HMAC verification (adjust based on your webhook service implementation)
        const payload = JSON.stringify(req.body);
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payload);
        const expectedSignature = hmac.digest('hex');
        
        // Support both hex and base64 signatures
        const receivedSig = signature.replace('sha256=', '').replace('sha1=', '');
        signatureValid = receivedSig === expectedSignature || 
                        crypto.timingSafeEqual(
                          Buffer.from(receivedSig, 'hex'),
                          Buffer.from(expectedSignature, 'hex')
                        );
      } catch (err) {
        logger.warn('Signature verification failed', { error: err });
        signatureValid = false;
      }
    }

    const webhook: ReceivedWebhook = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      method: req.method,
      url: req.url,
      headers: req.headers as Record<string, string>,
      body: req.body,
      signature: signature || undefined,
      signatureValid,
      query: req.query as Record<string, string>,
    };

    // Store webhook (keep only last MAX_STORED_WEBHOOKS)
    receivedWebhooks.unshift(webhook);
    if (receivedWebhooks.length > MAX_STORED_WEBHOOKS) {
      receivedWebhooks.pop();
    }

    // Log the webhook
    logger.info('Webhook received', {
      id: webhook.id,
      url: webhook.url,
      method: webhook.method,
      hasSignature: !!signature,
      signatureValid,
      ackRequired,
      eventId,
      bodyKeys: Object.keys(req.body || {}),
      timestamp: webhook.timestamp.toISOString(),
    });

    // Auto-acknowledge if acknowledgement is required and URL is provided
    let acknowledged = false;
    if (ackRequired && ackUrl && eventId) {
      try {
        const url = new URL(ackUrl);
        const client = url.protocol === 'https:' ? https : http;
        
        const ackPayload = JSON.stringify({ status: 'processed' });
        const ackOptions = {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(ackPayload),
          },
        };

        await new Promise<void>((resolve) => {
          const ackReq = client.request(ackOptions, (ackRes: any) => {
            ackRes.on('data', () => {});
            ackRes.on('end', () => {
              acknowledged = ackRes.statusCode >= 200 && ackRes.statusCode < 300;
              logger.info('Acknowledgement sent', { eventId, statusCode: ackRes.statusCode, acknowledged });
              resolve();
            });
          });

          ackReq.on('error', (err: Error) => {
            logger.warn('Failed to send acknowledgement', { eventId, error: err.message });
            resolve(); // Don't fail the webhook receipt
          });

          ackReq.write(ackPayload);
          ackReq.end();
        });
      } catch (err: any) {
        logger.warn('Error sending acknowledgement', { eventId, error: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Webhook received successfully',
      webhookId: webhook.id,
      timestamp: webhook.timestamp.toISOString(),
      signatureValid,
      acknowledged: ackRequired ? acknowledged : undefined,
      eventId,
    });
  } catch (error: any) {
    logger.error('Error processing webhook', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process webhook',
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/webhook-test/webhooks:
 *   get:
 *     summary: List all received webhooks
 *     description: Get a list of all webhooks received by the test listener
 *     tags: [Webhooks - Testing]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Maximum number of webhooks to return
 *     responses:
 *       200:
 *         description: List of received webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       method:
 *                         type: string
 *                       url:
 *                         type: string
 *                       headers:
 *                         type: object
 *                       body:
 *                         type: object
 *                       signature:
 *                         type: string
 *                       signatureValid:
 *                         type: boolean
 */
router.get('/webhooks', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '20', 10);
  const webhooks = receivedWebhooks.slice(0, limit).map(w => ({
    id: w.id,
    timestamp: w.timestamp,
    method: w.method,
    url: w.url,
    headers: w.headers,
    body: w.body,
    signature: w.signature,
    signatureValid: w.signatureValid,
    query: w.query,
  }));

  res.json({
    success: true,
    data: webhooks,
    total: receivedWebhooks.length,
    limit,
  });
});

/**
 * @swagger
 * /api/webhook-test/webhooks/{id}:
 *   get:
 *     summary: Get a specific webhook by ID
 *     description: Retrieve details of a specific webhook received by the test listener
 *     tags: [Webhooks - Testing]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Webhook ID
 *     responses:
 *       200:
 *         description: Webhook details
 *       404:
 *         description: Webhook not found
 */
router.get('/webhooks/:id', (req: Request, res: Response) => {
  const webhook = receivedWebhooks.find(w => w.id === req.params.id);
  
  if (!webhook) {
    return res.status(404).json({
      success: false,
      error: 'Webhook not found',
    });
  }

  res.json({
    success: true,
    data: webhook,
  });
});

/**
 * @swagger
 * /api/webhook-test/clear:
 *   delete:
 *     summary: Clear all stored webhooks
 *     description: Remove all webhooks from the test listener storage
 *     tags: [Webhooks - Testing]
 *     responses:
 *       200:
 *         description: Webhooks cleared successfully
 */
router.delete('/clear', (req: Request, res: Response) => {
  const count = receivedWebhooks.length;
  receivedWebhooks.length = 0;
  
  logger.info('Cleared webhook test storage', { count });
  
  res.json({
    success: true,
    message: `Cleared ${count} webhooks`,
  });
});

export default router;

