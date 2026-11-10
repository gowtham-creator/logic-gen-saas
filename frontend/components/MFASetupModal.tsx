'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Copy, Check, AlertCircle, Download } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/constants/routes';
import { notificationService } from '@/lib/notifications';

interface MFASetupModalProps {
  userId?: string;
  clientId?: string;
  onClose: () => void;
  onSuccess?: (tokens?: any, user?: any) => void;
}

export default function MFASetupModal({ userId, clientId, onClose, onSuccess }: MFASetupModalProps): ReactNode {
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (step === 'setup') {
      setupMFA();
    }
  }, [step]);

  const setupMFA = async () => {
    try {
      // Use setup-login endpoint if userId and clientId are provided (login flow)
      // Otherwise use regular setup endpoint (requires authentication)
      const endpoint = userId && clientId 
        ? API_ENDPOINTS.MFA.SETUP_LOGIN 
        : API_ENDPOINTS.MFA.SETUP;
      const payload = userId && clientId 
        ? { userId, clientId }
        : {};
      
      const response = await apiClient.post<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>(endpoint, payload);
      if (response) {
        setQrCodeUrl(response.qrCodeUrl);
        setSecret(response.secret);
        setBackupCodes(response.backupCodes);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Failed to setup MFA';
      setError(errorMessage);
      notificationService.error(errorMessage);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!token || token.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    if (!secret || !backupCodes || backupCodes.length === 0) {
      setError('MFA setup data is missing. Please go back and try again.');
      return;
    }

    setVerifying(true);
    try {
      // Use verify-and-enable-login endpoint if userId and clientId are provided (login flow)
      // Otherwise use regular verify endpoint (requires authentication)
      const endpoint = userId && clientId 
        ? API_ENDPOINTS.MFA.VERIFY_AND_ENABLE_LOGIN 
        : API_ENDPOINTS.MFA.VERIFY;
      const payload = userId && clientId
        ? { userId, clientId, token, secret, backupCodes }
        : { token, secret, backupCodes };
      
      const response = await apiClient.post<{ enabled: boolean; tokens?: any; user?: any }>(endpoint, payload);
      if (response && response.enabled) {
        notificationService.success('MFA enabled successfully');
        // If tokens are returned (login flow), pass them to onSuccess
        if (response.tokens && response.user && onSuccess) {
          onSuccess(response.tokens, response.user);
        } else {
          onSuccess?.();
        }
        onClose();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Invalid verification code';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const downloadBackupCodes = () => {
    const content = `MFA Backup Codes\n\nSave these codes in a safe place. Each code can only be used once.\n\n${backupCodes.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary-100">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {step === 'setup' ? 'Setup Two-Factor Authentication' : 'Verify Setup'}
            </h2>
          </div>
          <button onClick={onClose} className="btn-icon" disabled={verifying}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-800">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {step === 'setup' ? (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Scan the QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
              </p>
            </div>

            <div className="flex flex-col items-center space-y-4">
              {qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              )}

              <div className="w-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Manual Entry Key
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={secret}
                    readOnly
                    className="input-field flex-1 font-mono text-sm"
                  />
                  <button
                    onClick={copySecret}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  If you can&apos;t scan the QR code, enter this key manually in your authenticator app
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Backup Codes</h3>
              <p className="text-xs text-gray-600 mb-3">
                Save these codes in a safe place. You can use them to access your account if you lose access to your authenticator device.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="text-gray-800">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={copyBackupCodes}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                >
                  {codesCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Codes</span>
                    </>
                  )}
                </button>
                <button
                  onClick={downloadBackupCodes}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => setStep('verify')}
                className="btn-primary"
              >
                Continue to Verification
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4 sm:space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Enter the 6-digit code from your authenticator app to complete setup.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="input-field text-center text-2xl font-mono tracking-widest"
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStep('setup')}
                disabled={verifying}
                className="btn-secondary"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={verifying || token.length !== 6}
                className="btn-primary flex items-center space-x-2"
              >
                {verifying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    <span>Verify & Enable</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

