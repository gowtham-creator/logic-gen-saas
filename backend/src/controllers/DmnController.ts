import { Response } from 'express';
import { AuthenticatedRequest } from '../types/middleware.types';
import { sendSuccess, sendError } from '../utils/response';
import { ERROR_CODES } from '../constants/errors';
import { dmnPipelineService, INTENT_TO_STOP_AT, type DmnIntent } from '../services/DMNPipelineService';
import { setJobClient, belongsToClient, getJobIdsForClient, removeJobClient } from '../services/DmnJobStore';
import { WorkflowService } from '../services/WorkflowService';
import { StorageService } from '../services/StorageService';
import { logger } from '../utils/logger';
import { asParam } from '../utils/params';

const workflowService = new WorkflowService();
const storageService = new StorageService();

const VALID_INTENTS: DmnIntent[] = ['summarize', 'dmn_tables', 'dmn_code'];

/**
 * Run DMN pipeline on a workflow document.
 * Body: { fileId: string, intent: 'summarize' | 'dmn_tables' | 'dmn_code', dmnName?: string }
 * - summarize: extract rules and entities (stop_at=rules)
 * - dmn_tables: decision tables (stop_at=aggregation)
 * - dmn_code: full DMN XML with validation (stop_at=refinement)
 */
export async function runPipeline(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.clientId!;
  const { fileId, intent, dmnName } = req.body as {
    fileId?: string;
    intent?: string;
    dmnName?: string;
  };

  logger.info('[DMN] runPipeline request', {
    clientId,
    fileId,
    intent,
    dmnName,
    userId: req.userId,
  });

  try {
    if (!fileId || typeof fileId !== 'string') {
      logger.warn('[DMN] runPipeline validation failed: fileId required', { clientId });
      sendError(res, ERROR_CODES.VALIDATION_ERROR, 'fileId is required', 400);
      return;
    }

    if (!intent || !VALID_INTENTS.includes(intent as DmnIntent)) {
      logger.warn('[DMN] runPipeline validation failed: invalid intent', { clientId, intent, valid: VALID_INTENTS });
      sendError(
        res,
        ERROR_CODES.VALIDATION_ERROR,
        `intent must be one of: ${VALID_INTENTS.join(', ')}`,
        400
      );
      return;
    }

    const file = await workflowService.getWorkflowFileById(fileId, clientId, req);
    if (!file) {
      logger.warn('[DMN] runPipeline file not found', { clientId, fileId });
      sendError(res, ERROR_CODES.NOT_FOUND, 'File not found', 404);
      return;
    }

    logger.info('[DMN] runPipeline file resolved', {
      fileId,
      originalFileName: file.originalFileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    });

    const storageEngine = await storageService.getStorageEngine(clientId);
    if (!storageEngine) {
      logger.error('[DMN] runPipeline storage engine not configured', { clientId });
      sendError(res, ERROR_CODES.INTERNAL_ERROR, 'Storage engine not configured', 500);
      return;
    }

    let filePath = file.filePath;
    if (!filePath.startsWith(`${clientId}/`)) {
      filePath = `${clientId}/${filePath}`;
    }
    logger.debug('[DMN] runPipeline downloading from storage', { filePath });

    const fileBuffer = await storageEngine.downloadFile(filePath);
    if (!fileBuffer) {
      logger.warn('[DMN] runPipeline file not found in storage', { clientId, filePath });
      sendError(res, ERROR_CODES.NOT_FOUND, 'File not found in storage', 404);
      return;
    }

    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const stopAt = INTENT_TO_STOP_AT[intent as DmnIntent];
    const name = dmnName || file.originalFileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

    logger.info('[DMN] runPipeline calling AI service', {
      fileId,
      intent,
      stopAt,
      dmnName: name,
      bufferBytes: buffer.length,
    });

    const result = await dmnPipelineService.runPipeline(buffer, file.originalFileName, {
      dmnName: name,
      stopAt,
    });

    setJobClient(result.job_id, clientId);

    logger.info('[DMN] runPipeline started', {
      jobId: result.job_id,
      documentId: result.document_id,
      clientId,
      intent,
      stopAt: result.stop_at,
    });

    sendSuccess(res, {
      jobId: result.job_id,
      documentId: result.document_id,
      dmnName: result.dmn_name,
      stopAt: result.stop_at,
      status: result.status,
      message: result.message,
    }, 202);
  } catch (error: any) {
    logger.error('[DMN] runPipeline error', {
      clientId,
      fileId,
      intent,
      error: error?.message,
      stack: error?.stack,
    });
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to start DMN pipeline',
      500
    );
  }
}

/**
 * Get job progress. Job must belong to current client.
 */
export async function getJobProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = asParam(req.params.jobId);
  const clientId = req.clientId!;

  logger.debug('[DMN] getJobProgress request', { jobId, clientId });

  try {
    if (!jobId) {
      logger.warn('[DMN] getJobProgress validation failed: jobId required', { clientId });
      sendError(res, ERROR_CODES.VALIDATION_ERROR, 'jobId is required', 400);
      return;
    }

    if (!belongsToClient(jobId, clientId)) {
      logger.warn('[DMN] getJobProgress job not found or wrong client', { jobId, clientId });
      sendError(res, ERROR_CODES.NOT_FOUND, 'Job not found', 404);
      return;
    }

    const progress = await dmnPipelineService.getJobProgress(jobId);
    logger.debug('[DMN] getJobProgress result', {
      jobId,
      status: progress.status,
      progress: progress.progress,
      current_stage: progress.current_stage,
    });
    sendSuccess(res, progress);
  } catch (error: any) {
    logger.error('[DMN] getJobProgress error', { jobId, clientId, error: error?.message });
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to get job progress',
      500
    );
  }
}

/**
 * Get job result. Job must belong to current client.
 */
export async function getJobResult(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = asParam(req.params.jobId);
  const clientId = req.clientId!;

  logger.info('[DMN] getJobResult request', { jobId, clientId });

  try {
    if (!jobId) {
      logger.warn('[DMN] getJobResult validation failed: jobId required', { clientId });
      sendError(res, ERROR_CODES.VALIDATION_ERROR, 'jobId is required', 400);
      return;
    }

    if (!belongsToClient(jobId, clientId)) {
      logger.warn('[DMN] getJobResult job not found or wrong client', { jobId, clientId });
      sendError(res, ERROR_CODES.NOT_FOUND, 'Job not found', 404);
      return;
    }

    const result = await dmnPipelineService.getJobResult(jobId);
    const hasDmnXml = Boolean(result.result?.dmn_xml);
    const hasExtractRules = Boolean(result.result?.extract_rules);
    const hasBuildTables = Boolean(result.result?.build_tables);
    logger.info('[DMN] getJobResult success', {
      jobId,
      clientId,
      stopped_at: result.stopped_at,
      hasDmnXml,
      hasExtractRules,
      hasBuildTables,
    });
    sendSuccess(res, result);
  } catch (error: any) {
    logger.error('[DMN] getJobResult error', { jobId, clientId, error: error?.message });
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to get job result',
      500
    );
  }
}

/**
 * List DMN jobs for the current client (tenant-scoped).
 * Returns only jobs that were started by this client.
 */
export async function listJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.clientId!;
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);

  logger.debug('[DMN] listJobs request', { clientId, limit });

  try {
    const allJobs = await dmnPipelineService.listJobs(limit);
    const clientJobIds = new Set(getJobIdsForClient(clientId));
    const jobs = allJobs.filter((j) => clientJobIds.has(j.job_id));
    logger.info('[DMN] listJobs success', { clientId, total: allJobs.length, filtered: jobs.length });
    sendSuccess(res, { jobs, count: jobs.length });
  } catch (error: any) {
    logger.error('[DMN] listJobs error', { clientId, error: error?.message });
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to list jobs',
      500
    );
  }
}

/**
 * Delete a DMN job. Job must belong to current client.
 */
export async function deleteJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = asParam(req.params.jobId);
  const clientId = req.clientId!;

  logger.info('[DMN] deleteJob request', { jobId, clientId });

  try {
    if (!jobId) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, 'jobId is required', 400);
      return;
    }
    if (!belongsToClient(jobId, clientId)) {
      logger.warn('[DMN] deleteJob job not found or wrong client', { jobId, clientId });
      sendError(res, ERROR_CODES.NOT_FOUND, 'Job not found', 404);
      return;
    }
    await dmnPipelineService.deleteJob(jobId);
    removeJobClient(jobId);
    logger.info('[DMN] deleteJob success', { jobId, clientId });
    sendSuccess(res, { message: 'Job deleted', jobId });
  } catch (error: any) {
    logger.error('[DMN] deleteJob error', { jobId, clientId, error: error?.message });
    if (error?.message === 'Job not found') {
      sendError(res, ERROR_CODES.NOT_FOUND, 'Job not found', 404);
      return;
    }
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to delete job',
      500
    );
  }
}

/**
 * Resume a completed DMN job (continue pipeline with optional new stop_at).
 * Returns new job_id for polling.
 */
export async function resumeJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = asParam(req.params.jobId);
  const clientId = req.clientId!;
  const { stopAt } = (req.body as { stopAt?: string }) || {};

  logger.info('[DMN] resumeJob request', { jobId, clientId, stopAt });

  try {
    if (!jobId) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, 'jobId is required', 400);
      return;
    }
    if (!belongsToClient(jobId, clientId)) {
      logger.warn('[DMN] resumeJob job not found or wrong client', { jobId, clientId });
      sendError(res, ERROR_CODES.NOT_FOUND, 'Job not found', 404);
      return;
    }
    const result = await dmnPipelineService.resumeJob(jobId, stopAt);
    setJobClient(result.job_id, clientId);
    logger.info('[DMN] resumeJob started', {
      previousJobId: jobId,
      newJobId: result.job_id,
      clientId,
      stopAt: result.stop_at,
    });
    sendSuccess(
      res,
      {
        jobId: result.job_id,
        previousJobId: result.previous_job_id,
        documentId: result.document_id,
        resumeFrom: result.resume_from,
        stopAt: result.stop_at,
        status: result.status,
        message: result.message,
      },
      202
    );
  } catch (error: any) {
    logger.error('[DMN] resumeJob error', { jobId, clientId, error: error?.message });
    if (error?.message?.includes('not found') || error?.message?.includes('not completed')) {
      sendError(res, ERROR_CODES.VALIDATION_ERROR, error.message, 400);
      return;
    }
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to resume job',
      500
    );
  }
}

/**
 * Get job status (lightweight).
 */
export async function getJobStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobId = asParam(req.params.jobId);
  const clientId = req.clientId!;

  logger.debug('[DMN] getJobStatus request', { jobId, clientId });

  try {
    if (!jobId) {
      logger.warn('[DMN] getJobStatus validation failed: jobId required', { clientId });
      sendError(res, ERROR_CODES.VALIDATION_ERROR, 'jobId is required', 400);
      return;
    }

    if (!belongsToClient(jobId, clientId)) {
      logger.warn('[DMN] getJobStatus job not found or wrong client', { jobId, clientId });
      sendError(res, ERROR_CODES.NOT_FOUND, 'Job not found', 404);
      return;
    }

    const status = await dmnPipelineService.getJobStatus(jobId);
    logger.debug('[DMN] getJobStatus result', { jobId, status: status.status, progress: status.progress });
    sendSuccess(res, status);
  } catch (error: any) {
    logger.error('[DMN] getJobStatus error', { jobId, clientId, error: error?.message });
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to get job status',
      500
    );
  }
}

/**
 * List pipeline stages (for UI).
 */
export async function getStages(req: AuthenticatedRequest, res: Response): Promise<void> {
  logger.debug('[DMN] getStages request', { clientId: req.clientId });

  try {
    const stages = await dmnPipelineService.getStages();
    logger.info('[DMN] getStages success', { stageCount: stages.stages?.length ?? 0 });
    sendSuccess(res, stages);
  } catch (error: any) {
    logger.error('[DMN] getStages error', { error: error?.message });
    sendError(
      res,
      ERROR_CODES.INTERNAL_ERROR,
      error.message || 'Failed to get pipeline stages',
      500
    );
  }
}

/**
 * Check if DMN pipeline service is available.
 */
export async function getHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const available = await dmnPipelineService.isAvailable();
    logger.debug('[DMN] health check', { available });
    sendSuccess(res, { available });
  } catch (e) {
    logger.warn('[DMN] health check failed', { error: e instanceof Error ? e.message : String(e) });
    sendSuccess(res, { available: false });
  }
}
