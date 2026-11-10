'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, AlertCircle, Copy, Check, Download } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/constants/routes';
import { notificationService } from '@/lib/notifications';
import Image from 'next/image';

type AuthView = 'login' | 'mfa-setup' | 'mfa-verification';

interface AuthConfig {
  ssoEnabled: boolean;
  ssoProvider?: 'oidc' | 'saml';
  mfaRequired: boolean;
  allowPasswordLogin: boolean;
}

export default function AuthPage() {
  const router = useRouter();

  // View state
  const [currentView, setCurrentView] = useState<AuthView>('login');

  // Auth config state
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [loadingAuthConfig, setLoadingAuthConfig] = useState(true);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // MFA state
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaClientId, setMfaClientId] = useState('');
  const [mfaDeviceInfo, setMfaDeviceInfo] = useState<any>(null);
  const [mfaUserName, setMfaUserName] = useState('');

  // MFA Setup state
  const [mfaStep, setMfaStep] = useState<'setup' | 'verify'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);

  // MFA Verification state - OTP inputs
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [verifying, setVerifying] = useState(false);

  // Fetch auth config on mount
  useEffect(() => {
    const fetchAuthConfig = async () => {
      try {
        setLoadingAuthConfig(true);
        const config = await apiClient.get<AuthConfig>(API_ENDPOINTS.AUTH.CONFIG);
        setAuthConfig(config);
      } catch (error) {
        console.error('Failed to fetch auth config:', error);
        setAuthConfig({
          ssoEnabled: false,
          mfaRequired: false,
          allowPasswordLogin: true,
        });
      } finally {
        setLoadingAuthConfig(false);
      }
    };

    fetchAuthConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { collectDeviceInfo } = await import('@/lib/deviceInfo');
      const deviceInfo = collectDeviceInfo();

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceInfo }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Invalid credentials');
      }

      const { user, tokens, mustResetPassword, requiresMFA: needsMFA, requiresMFASetup: needsMFASetup } = data.data || {};

      if (mustResetPassword) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('tempUser', JSON.stringify(user));
        }
        router.push('/reset-password');
        return;
      }

      if (needsMFASetup) {
        setMfaUserId(user.id);
        setMfaClientId(user.clientId || '');
        setMfaDeviceInfo(deviceInfo);
        setMfaUserName(user.name || user.email);
        setCurrentView('mfa-setup');
        await setupMFA(user.id, user.clientId);
        setIsLoading(false);
        return;
      }

      if (needsMFA) {
        setMfaUserId(user.id);
        setMfaClientId(user.clientId || '');
        setMfaDeviceInfo(deviceInfo);
        setMfaUserName(user.name || user.email);
        setCurrentView('mfa-verification');
        setIsLoading(false);
        return;
      }

      if (tokens && typeof window !== 'undefined') {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(user));

        if (user.isSuperAdmin) {
          localStorage.setItem('isSuperAdmin', 'true');
        } else {
          localStorage.removeItem('isSuperAdmin');
        }
        if (user.isDeveloper) {
          localStorage.setItem('isDeveloper', 'true');
        } else {
          localStorage.removeItem('isDeveloper');
        }

        window.dispatchEvent(new Event('auth-state-changed'));

        setTimeout(() => {
          router.replace('/dashboard');
        }, 50);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Network Error') || err.message?.includes('Failed to fetch')) {
        setError('Cannot connect to server. Please check if the backend is running.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setupMFA = async (userId: string, clientId: string) => {
    try {
      const endpoint = API_ENDPOINTS.MFA.SETUP_LOGIN;
      const payload = { userId, clientId };

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

  const handleMFASetupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const token = otp.join('');
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
      const endpoint = API_ENDPOINTS.MFA.VERIFY_AND_ENABLE_LOGIN;
      const payload = {
        userId: mfaUserId,
        clientId: mfaClientId,
        token,
        secret,
        backupCodes,
        deviceInfo: mfaDeviceInfo
      };

      const response = await apiClient.post<{ enabled: boolean; tokens?: any; user?: any }>(endpoint, payload);
      if (response && response.enabled) {
        notificationService.success('MFA enabled successfully');
        setOtp(['', '', '', '', '', '']);
        setCurrentView('mfa-verification');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Invalid verification code';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  const handleMFAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const token = otp.join('');
    if (!token || token.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      const response = await apiClient.post<{ tokens: any; user: any; usedBackupCode: boolean }>(API_ENDPOINTS.MFA.VERIFY_LOGIN, {
        userId: mfaUserId,
        token,
        clientId: mfaClientId,
        deviceInfo: mfaDeviceInfo,
      });

      if (response && response.tokens) {
        const { tokens, user } = response;

        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);
          localStorage.setItem('user', JSON.stringify(user));

          if (user.isSuperAdmin) {
            localStorage.setItem('isSuperAdmin', 'true');
          } else {
            localStorage.removeItem('isSuperAdmin');
          }
          if (user.isDeveloper) {
            localStorage.setItem('isDeveloper', 'true');
          } else {
            localStorage.removeItem('isDeveloper');
          }

          window.dispatchEvent(new Event('auth-state-changed'));
          router.replace('/dashboard');
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || 'Invalid verification code';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  // OTP Input Handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setOtp(newOtp.slice(0, 6));

    const nextIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
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

  const handleBack = () => {
    if (currentView === 'mfa-verification' && mfaStep === 'verify') {
      setMfaStep('setup');
      setOtp(['', '', '', '', '', '']);
      setError('');
    } else if (currentView === 'mfa-setup' && mfaStep === 'verify') {
      setMfaStep('setup');
      setOtp(['', '', '', '', '', '']);
      setError('');
    } else {
      setCurrentView('login');
      setMfaStep('setup');
      setOtp(['', '', '', '', '', '']);
      setError('');
      setMfaUserId('');
      setMfaClientId('');
      setQrCodeUrl('');
      setSecret('');
      setBackupCodes([]);
    }
  };

  const handleSSOLogin = () => {
    if (authConfig?.ssoProvider === 'oidc') {
      window.location.href = '/api/auth/oidc/authorize';
    } else if (authConfig?.ssoProvider === 'saml') {
      window.location.href = '/api/auth/saml/authorize';
    } else {
      window.location.href = '/api/auth/oidc/authorize';
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Background Image with Overlay Text */}
      <div className="hidden lg:flex lg:w-1/2 relative p-3">
        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-[rgba(0,0,0,0.1)_0px_0px_40px]">
          <Image
            src="/images/auth-left-bg-abstract.png"
            alt="Background"
            fill
            className="object-cover"
            priority
          />
          {/* Overlay Text at Bottom */}
          <div className="absolute bottom-12 left-12 z-10 max-w-lg">
            <p className="text-gray-600 text-sm mb-2">Welcome to</p>
            <h1 className="text-5xl font-bold text-[#5B4CCC] leading-tight">
              Optimize your DMN&apos;s with Logicgen.
            </h1>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">

          {/* Login View */}
          {currentView === 'login' && (
            <>
              <div className="mb-8">
                <h2 className="text-4xl font-bold text-[#5B4CCC] mb-3">Sign In To Your Account</h2>
                <p className="text-gray-600">Let&apos;s sign in to your account and get started</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Id
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4CCC] focus:border-transparent transition-all duration-200 outline-none"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B4CCC] focus:border-transparent transition-all duration-200 outline-none pr-12"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <a href="#" className="text-sm text-[#5B4CCC] hover:underline">
                    Forgot Password
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#5B4CCC] text-white font-semibold py-3.5 px-4 rounded-lg hover:bg-[#4a3db3] focus:outline-none focus:ring-2 focus:ring-[#5B4CCC] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>

              {!loadingAuthConfig && authConfig?.ssoEnabled && (
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500">OR</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSSOLogin}
                    className="w-full mt-4 bg-white text-[#5B4CCC] font-semibold py-3.5 px-4 rounded-lg border-2 border-[#5B4CCC] hover:bg-[#5B4CCC] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#5B4CCC] focus:ring-offset-2 transition-all duration-200"
                  >
                    Login with SSO
                  </button>
                </div>
              )}
            </>
          )}

          {/* MFA Setup View */}
          {currentView === 'mfa-setup' && (
            <>
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#5B4CCC] mb-3">
                  {mfaStep === 'setup' ? 'Setup 2FA' : `Welcome! ${mfaUserName}`}
                </h2>
                <p className="text-gray-600">
                  {mfaStep === 'setup'
                    ? 'Secure your account with two-factor authentication'
                    : 'Just one more step to go!'}
                </p>
                {mfaStep === 'verify' && (
                  <p className="text-gray-600 mt-1">Enter your OTP for authentication</p>
                )}
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">{error}</p>
                </div>
              )}

              {mfaStep === 'setup' ? (
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
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B4CCC] focus:border-transparent transition-all duration-200 bg-gray-50 font-mono text-sm"
                        />
                        <button
                          onClick={copySecret}
                          className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow flex items-center space-x-2"
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
                        If you can&apos;t scan the QR code, enter this key manually
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Backup Codes</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Save these codes in a safe place. You can use them to access your account if you lose your device.
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
                        className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow flex items-center space-x-2 text-sm"
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
                        className="px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow flex items-center space-x-2 text-sm"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setMfaStep('verify')}
                    className="w-full bg-[#5B4CCC] text-white font-semibold py-3.5 px-4 rounded-lg hover:bg-[#4a3db3] focus:outline-none focus:ring-2 focus:ring-[#5B4CCC] focus:ring-offset-2 transition-all duration-200"
                  >
                    Continue to Verification
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMFASetupVerify} className="space-y-6">
                  <div className="flex justify-center gap-3">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { otpInputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        className="w-14 h-14 text-center text-2xl font-semibold border-2 border-[#5B4CCC] rounded-lg focus:ring-2 focus:ring-[#5B4CCC] focus:border-[#5B4CCC] transition-all duration-200 outline-none"
                        required
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={verifying || otp.join('').length !== 6}
                    className="w-full bg-[#5B4CCC] text-white font-semibold py-3.5 px-4 rounded-lg hover:bg-[#4a3db3] focus:outline-none focus:ring-2 focus:ring-[#5B4CCC] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : (
                      'Login'
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* MFA Verification View */}
          {currentView === 'mfa-verification' && (
            <>
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-bold text-[#5B4CCC] mb-3">
                  Welcome! {mfaUserName}
                </h2>
                <p className="text-gray-600">Just one more step to go!</p>
                <p className="text-gray-600 mt-1">Enter your OTP for authentication</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 flex-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleMFAVerify} className="space-y-6">
                <div className="flex justify-center gap-3">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="w-14 h-14 text-center text-2xl font-semibold border-2 border-[#5B4CCC] rounded-lg focus:ring-2 focus:ring-[#5B4CCC] focus:border-[#5B4CCC] transition-all duration-200 outline-none"
                      required
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={verifying || otp.join('').length !== 6}
                  className="w-full bg-[#5B4CCC] text-white font-semibold py-3.5 px-4 rounded-lg hover:bg-[#4a3db3] focus:outline-none focus:ring-2 focus:ring-[#5B4CCC] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
