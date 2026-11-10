'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/constants/routes';
import { notificationService } from '@/lib/notifications';

interface MFAVerificationModalProps {
  userId: string;
  clientId?: string;
  mfaUser?: any;
  onClose: () => void;
  onSuccess: (tokens?: any) => void;
}

export default function MFAVerificationModal({ userId, clientId, onClose, onSuccess }: MFAVerificationModalProps): ReactNode {
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Accept either 6-digit TOTP code or 8-character alphanumeric backup code
    if (!token || (token.length !== 6 && token.length !== 8)) {
      setError('Please enter a valid 6-digit TOTP code or 8-character backup code');
      return;
    }
    
    // Validate format: 6 digits for TOTP, or 8 alphanumeric for backup code
    if (token.length === 6 && !/^\d{6}$/.test(token)) {
      setError('TOTP code must be 6 digits');
      return;
    }
    
    if (token.length === 8 && !/^[A-Z0-9]{8}$/.test(token)) {
      setError('Backup code must be 8 alphanumeric characters');
      return;
    }

    setVerifying(true);
    try {
      const response = await apiClient.post<{ tokens: any; user: any; usedBackupCode: boolean }>(API_ENDPOINTS.MFA.VERIFY_LOGIN, {
        userId,
        token,
        clientId,
      });
      
      if (response && response.tokens) {
        // MFA verified successfully, return tokens to parent
        onSuccess(response);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Invalid verification code';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary-100">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Two-Factor Authentication
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

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            Enter the 6-digit code from your authenticator app, or an 8-character backup code to complete login.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => {
                // Allow alphanumeric, convert to uppercase, limit to 8 characters
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                setToken(value);
              }}
              placeholder="000000 or ABC12345"
              maxLength={8}
              className="input-field text-center text-2xl font-mono tracking-widest"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter 6-digit TOTP code or 8-character backup code (alphanumeric)
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying || (token.length !== 6 && token.length !== 8)}
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
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

