'use client';

import { useState, useEffect } from 'react';
import { Building2, X, CheckCircle, Globe, CreditCard, Calendar, Shield, Key, Database, AlertTriangle, Loader2, User, HardDrive } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { Client, ClientModalProps, StorageEngine, StorageConfig } from '@/types';
import PasswordInput from '@/components/PasswordInput';

export default function ClientModal({ client, plans, onClose, onSave }: ClientModalProps) {
  const [formData, setFormData] = useState<Client>({
    name: '',
    subdomain: '',
    planId: undefined,
    isActive: true,
    allowSuperAdminLogin: false,
    ssoConfig: {
      enabled: false,
      provider: 'oidc',
    },
    databaseConfig: {
      isolationLevel: 'shared',
      allowCustomTables: false,
      allowCustomColumns: false,
      allowCustomMigrations: false,
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSSOConfig, setShowSSOConfig] = useState(false);
  const [showDatabaseConfig, setShowDatabaseConfig] = useState(false);
  const [showStorageConfig, setShowStorageConfig] = useState(false);
  const [ssoMetadataFields, setSsoMetadataFields] = useState<Record<string, string>>({});
  const [storageEngines, setStorageEngines] = useState<StorageEngine[]>([]);
  const [storageConfig, setStorageConfig] = useState<StorageConfig | null>(null);
  const [loadingStorageEngines, setLoadingStorageEngines] = useState(false);
  const [adminUserData, setAdminUserData] = useState({
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
  });
  const [emailError, setEmailError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState<{ needed: boolean; reason?: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [showMigrationWarning, setShowMigrationWarning] = useState(false);
  const [originalIsolationLevel, setOriginalIsolationLevel] = useState<string>('shared');
  const [removeFromSource, setRemoveFromSource] = useState(false);

  useEffect(() => {
    loadStorageEngines();
    if (client) {
      const dbConfig = client.databaseConfig || {
        isolationLevel: 'shared',
        allowCustomTables: false,
        allowCustomColumns: false,
        allowCustomMigrations: false,
      };
      setFormData({
        name: client.name || '',
        subdomain: client.subdomain || '',
        planId: client.planId,
        planExpiresAt: client.planExpiresAt,
        isActive: client.isActive !== undefined ? client.isActive : true,
        allowSuperAdminLogin: client.allowSuperAdminLogin !== undefined ? client.allowSuperAdminLogin : false,
        ssoConfig: client.ssoConfig || {
          enabled: false,
          provider: 'oidc',
        },
        databaseConfig: dbConfig,
      });
      // Initialize SSO metadata fields from existing metadata
      if (client.ssoConfig?.metadata) {
        const metadata = client.ssoConfig.metadata as Record<string, string>;
        setSsoMetadataFields(metadata);
      } else {
        setSsoMetadataFields({});
      }
      setOriginalIsolationLevel(dbConfig.isolationLevel);
      setShowSSOConfig(client.ssoConfig?.enabled || false);
      setShowDatabaseConfig(!!client.databaseConfig);
      
      // Always try to load storage config for existing clients
      if (client.id) {
        loadClientStorageConfig(client.id);
      }
      
      // If storage config is already in client object, use it
      if (client.storageConfig) {
        setStorageConfig(client.storageConfig);
        setShowStorageConfig(true);
      }
    }
  }, [client]);

  const loadStorageEngines = async () => {
    try {
      setLoadingStorageEngines(true);
      const engines = await apiClient.get<StorageEngine[]>('/api/storage/engines');
      setStorageEngines(engines);
    } catch (error: any) {
      console.error('Failed to load storage engines:', error);
    } finally {
      setLoadingStorageEngines(false);
    }
  };

  const loadClientStorageConfig = async (clientId: string) => {
    try {
      const config = await apiClient.get<StorageConfig>(`/api/storage/clients/${clientId}`);
      if (config && config.id) {
        setStorageConfig(config);
        setShowStorageConfig(true);
      }
    } catch (error: any) {
      // Config might not exist, that's okay - user can create one
      console.log('No storage config found for client');
      setStorageConfig(null);
    }
  };

  const checkMigrationNeeded = async () => {
    if (!client?.id || !formData.databaseConfig?.isolationLevel) return;

    try {
      // apiClient.post<T> returns T directly (unwraps ApiResponse)
      const migrationData = await apiClient.post<{ needed: boolean; reason?: string }>(`/api/clients/${client.id}/check-migration`, {
        newIsolationLevel: formData.databaseConfig.isolationLevel,
      });
      setMigrationNeeded(migrationData);
      if (migrationData.needed) {
        setShowMigrationWarning(true);
      }
    } catch (error: any) {
      console.error('Error checking migration:', error);
    }
  };

  // Check migration when isolation level changes
  useEffect(() => {
    if (client?.id && formData.databaseConfig?.isolationLevel && 
        formData.databaseConfig.isolationLevel !== originalIsolationLevel) {
      checkMigrationNeeded();
    } else {
      setMigrationNeeded(null);
      setShowMigrationWarning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.databaseConfig?.isolationLevel, client?.id, originalIsolationLevel]);

  const handleMigrate = async () => {
    if (!client?.id || !formData.databaseConfig?.isolationLevel) return;

    // Show confirmation if removing from source
    if (removeFromSource && originalIsolationLevel === 'shared') {
      const confirmed = window.confirm(
        '⚠️ WARNING: This will remove all data from the shared database after migration.\n\n' +
        'A SQL backup file will be created automatically before removal.\n\n' +
        'Are you sure you want to proceed?'
      );
      if (!confirmed) {
        return;
      }
    }

    setMigrating(true);
    try {
      interface MigrationResponse {
        success: boolean;
        recordsMigrated: number;
        tablesMigrated: string[];
        backupFile?: string;
        recordsRemoved?: number;
        error?: string;
      }
      
      const response = await apiClient.post<MigrationResponse>(`/api/clients/${client.id}/migrate-database`, {
        newIsolationLevel: formData.databaseConfig.isolationLevel,
        removeFromSource: removeFromSource && originalIsolationLevel === 'shared',
      });

      if (response.success) {
        let message = `Migration completed successfully! ${response.recordsMigrated} records migrated across ${response.tablesMigrated.length} tables.`;
        
        if (response.backupFile) {
          message += `\n\nBackup created: ${response.backupFile}`;
        }
        
        if (response.recordsRemoved) {
          message += `\n\nRemoved ${response.recordsRemoved} records from source database.`;
        }
        
        notificationService.success(message);
        setOriginalIsolationLevel(formData.databaseConfig.isolationLevel);
        setMigrationNeeded({ needed: false });
        setShowMigrationWarning(false);
        setRemoveFromSource(false);
        onSave(); // Refresh client data
      } else {
        notificationService.error(response.error || 'Migration failed');
      }
    } catch (error: any) {
      notificationService.error(error.message || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Prepare payload - only include ssoConfig if enabled
      const payload: any = {
        name: formData.name,
        subdomain: formData.subdomain,
        planId: formData.planId || null,
        planExpiresAt: formData.planExpiresAt || null,
        isActive: formData.isActive !== false,
        allowSuperAdminLogin: formData.allowSuperAdminLogin === true,
      };

      // Include SSO config if enabled, otherwise set to null to disable
      if (formData.ssoConfig?.enabled) {
        if (!formData.ssoConfig.provider) {
          setError('SSO provider is required when SSO is enabled');
          setSaving(false);
          return;
        }
        payload.ssoConfig = {
          enabled: true,
          provider: formData.ssoConfig.provider,
          metadata: formData.ssoConfig.metadata || {},
        };
      } else {
        // Explicitly disable SSO
        payload.ssoConfig = {
          enabled: false,
          provider: 'oidc',
        };
      }

      // Include database config if set
      if (formData.databaseConfig) {
        payload.databaseConfig = formData.databaseConfig;
      }

      // Include storage config if set
      if (storageConfig && storageConfig.storageEngineId && storageConfig.config) {
        payload.storageConfig = {
          storageEngineId: storageConfig.storageEngineId,
          config: storageConfig.config,
        };
      }

      // Include admin user data (required for new clients)
      if (!client?.id) {
        if (!adminUserData.adminEmail || !adminUserData.adminPassword || 
            !adminUserData.adminFirstName || !adminUserData.adminLastName) {
          setError('All admin user fields are required');
          setSaving(false);
          return;
        }
        payload.adminEmail = adminUserData.adminEmail;
        payload.adminPassword = adminUserData.adminPassword;
        payload.adminFirstName = adminUserData.adminFirstName;
        payload.adminLastName = adminUserData.adminLastName;
      }

      // Check if migration is needed before saving
      if (client?.id && formData.databaseConfig?.isolationLevel && 
          formData.databaseConfig.isolationLevel !== originalIsolationLevel && 
          migrationNeeded?.needed) {
        setError('Please complete the database migration before saving. Click "Migrate Now" to proceed.');
        setSaving(false);
        return;
      }

      if (client?.id) {
        await apiClient.put(`/api/clients/${client.id}`, payload);
      } else {
        await apiClient.post('/api/clients', payload);
      }
      notificationService.success(
        client?.id ? 'Client updated successfully' : 'Client created successfully'
      );
      onSave();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save client';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-4 sm:p-6 lg:p-8 max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-primary-100 rounded-lg">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {client?.id ? 'Edit Tenant' : 'Create Tenant'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="input-field"
              placeholder="e.g., Acme Corporation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Globe className="inline h-4 w-4 mr-1" />
              Subdomain *
            </label>
            <input
              type="text"
              value={formData.subdomain}
              onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase() })}
              required
              pattern="[a-z0-9-]+"
              className="input-field"
              placeholder="acme"
            />
            <p className="mt-2 text-sm text-gray-500">
              Only lowercase letters, numbers, and hyphens
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="inline h-4 w-4 mr-1" />
                Plan
              </label>
              <select
                value={formData.planId || ''}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value || undefined })}
                className="input-field"
              >
                <option value="">No plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Plan Expires At (optional)
              </label>
              <input
                type="datetime-local"
                value={formData.planExpiresAt ? new Date(formData.planExpiresAt).toISOString().slice(0, 16) : ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    planExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  })
                }
                className="input-field"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive !== false}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="allowSuperAdminLogin"
                checked={formData.allowSuperAdminLogin === true}
                onChange={(e) => setFormData({ ...formData, allowSuperAdminLogin: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="allowSuperAdminLogin" className="text-sm font-medium text-gray-700">
                Allow Super Admin Login
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Users from this tenant can access the super admin login screen
            </p>
          </div>

          {/* Admin User Section - Only show when creating new client */}
          {!client?.id && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Admin User *</h3>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Create an admin user for this tenant. The user will be required to reset their password on first login.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      value={adminUserData.adminEmail}
                      onChange={(e) => {
                        setAdminUserData({ ...adminUserData, adminEmail: e.target.value });
                        setEmailError(''); // Clear error on change
                      }}
                      onBlur={async (e) => {
                        const email = e.target.value.trim();
                        if (!email) {
                          setEmailError('');
                          return;
                        }
                        
                        // Basic email format validation
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(email)) {
                          setEmailError('Invalid email format');
                          return;
                        }

                        setCheckingEmail(true);
                        setEmailError('');
                        try {
                          const response = await apiClient.get<{ available: boolean }>('/api/users/check-email', {
                            params: { email },
                          });
                          if (!response.available) {
                            setEmailError('This email is already in use');
                          }
                        } catch (err: any) {
                          // If 400 error, email is not available
                          if (err.response?.status === 400) {
                            setEmailError(err.response?.data?.message || 'This email is already in use');
                          } else {
                            // Other errors, don't show error (might be network issue)
                            console.error('Error checking email:', err);
                          }
                        } finally {
                          setCheckingEmail(false);
                        }
                      }}
                      className={`input-field ${emailError ? 'border-red-500' : ''}`}
                      placeholder="admin@example.com"
                      required
                    />
                    {checkingEmail && (
                      <p className="text-xs text-gray-500 mt-1">Checking email availability...</p>
                    )}
                    {emailError && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <span>⚠</span> {emailError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Password *
                    </label>
                    <PasswordInput
                      value={adminUserData.adminPassword}
                      onChange={(e) => setAdminUserData({ ...adminUserData, adminPassword: e.target.value })}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={adminUserData.adminFirstName}
                      onChange={(e) => setAdminUserData({ ...adminUserData, adminFirstName: e.target.value })}
                      className="input-field"
                      placeholder="Admin"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={adminUserData.adminLastName}
                      onChange={(e) => setAdminUserData({ ...adminUserData, adminLastName: e.target.value })}
                      className="input-field"
                      placeholder="User"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-1">Note:</p>
                  <p>The admin user will be required to reset their password on first login for security purposes.</p>
                </div>
              </div>
            </div>
          )}

          {/* SSO Configuration Section */}
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">SSO Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSSOConfig(!showSSOConfig)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {showSSOConfig ? 'Hide' : 'Show'} SSO Settings
              </button>
            </div>

            {showSSOConfig && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ssoEnabled"
                    checked={formData.ssoConfig?.enabled || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ssoConfig: {
                          ...formData.ssoConfig,
                          enabled: e.target.checked,
                          provider: formData.ssoConfig?.provider || 'oidc',
                        },
                      })
                    }
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="ssoEnabled" className="text-sm font-medium text-gray-700">
                    Enable SSO
                  </label>
                </div>

                {formData.ssoConfig?.enabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="inline h-4 w-4 mr-1" />
                        SSO Provider *
                      </label>
                      <select
                        value={formData.ssoConfig?.provider || 'oidc'}
                        onChange={(e) => {
                          const newProvider = e.target.value as 'oidc' | 'saml';
                          // Clear metadata fields when switching providers
                          setSsoMetadataFields({});
                          setFormData({
                            ...formData,
                            ssoConfig: {
                              ...formData.ssoConfig,
                              provider: newProvider,
                              enabled: formData.ssoConfig?.enabled || false,
                              metadata: undefined,
                            },
                          });
                        }}
                        className="input-field"
                        required={formData.ssoConfig?.enabled}
                      >
                        <option value="oidc">OpenID Connect (OIDC)</option>
                        <option value="saml">SAML 2.0</option>
                      </select>
                    </div>

                    {formData.ssoConfig?.provider === 'oidc' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Issuer URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.issuer || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, issuer: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="https://sso.example.com"
                            required={formData.ssoConfig?.enabled}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            The OIDC issuer URL (e.g., https://sso.example.com)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Client ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.clientId || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, clientId: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="your-client-id"
                            required={formData.ssoConfig?.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Client Secret <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={ssoMetadataFields.clientSecret || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, clientSecret: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="your-client-secret"
                            required={formData.ssoConfig?.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Redirect URI
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.redirectUri || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, redirectUri: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="https://yourdomain.com/api/auth/oidc/callback"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Optional. Defaults to {typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/oidc/callback
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scope
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.scope || 'openid profile email'}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, scope: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="openid profile email"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Space-separated list of OAuth scopes (default: openid profile email)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Logout URL (Optional)
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.logoutUrl || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, logoutUrl: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="https://sso.example.com/oidc/logout"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Optional. Custom logout URL if provider doesn't expose end_session_endpoint or requires a specific URL format. If not provided, will use the endpoint from the OIDC discovery document.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Post-Logout Redirect URI (Optional)
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.postLogoutRedirectUri || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, postLogoutRedirectUri: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'oidc',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="https://yourdomain.com/login"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Optional. URL to redirect to after SSO logout. If not provided, defaults to the login page.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Entity ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.entityId || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, entityId: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'saml',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="https://sso.example.com/entity"
                            required={formData.ssoConfig?.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            SSO URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={ssoMetadataFields.ssoUrl || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, ssoUrl: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'saml',
                                },
                              });
                            }}
                            className="input-field"
                            placeholder="https://sso.example.com/sso"
                            required={formData.ssoConfig?.enabled}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            X.509 Certificate <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={ssoMetadataFields.x509Certificate || ''}
                            onChange={(e) => {
                              const newFields = { ...ssoMetadataFields, x509Certificate: e.target.value };
                              setSsoMetadataFields(newFields);
                              setFormData({
                                ...formData,
                                ssoConfig: {
                                  ...formData.ssoConfig,
                                  metadata: newFields,
                                  enabled: formData.ssoConfig?.enabled || false,
                                  provider: formData.ssoConfig?.provider || 'saml',
                                },
                              });
                            }}
                            className="input-field font-mono text-xs"
                            rows={6}
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            required={formData.ssoConfig?.enabled}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            The X.509 certificate for SAML signature verification
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Database Configuration Section */}
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Database Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDatabaseConfig(!showDatabaseConfig)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {showDatabaseConfig ? 'Hide' : 'Show'} Database Settings
              </button>
            </div>

            {showDatabaseConfig && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                {!formData.planId ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    Please select a plan first to configure database settings
                  </div>
                ) : (
                  <>
                    {(() => {
                      const selectedPlan = plans.find((p) => p.id === formData.planId);
                      const allowedLevels = selectedPlan?.databasePermissions?.allowedIsolationLevels || ['shared'];
                      
                      return (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Isolation Level
                            </label>
                            <select
                              value={formData.databaseConfig?.isolationLevel || 'shared'}
                              onChange={(e) => {
                                const newLevel = e.target.value as 'shared' | 'database';
                                setFormData({
                                  ...formData,
                                  databaseConfig: {
                                    ...formData.databaseConfig!,
                                    isolationLevel: newLevel,
                                  },
                                });
                              }}
                              className="input-field text-sm"
                            >
                              {allowedLevels.includes('shared') && <option value="shared">Shared Database</option>}
                              {allowedLevels.includes('database') && <option value="database">Database-per-Tenant</option>}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                              Allowed by plan: {allowedLevels.join(', ')}
                            </p>
                            {migrationNeeded?.needed && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-start space-x-2">
                                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-yellow-800">
                                      Database Migration Required
                                    </p>
                                    <p className="text-xs text-yellow-700 mt-1">
                                      {migrationNeeded.reason || 'Changing isolation level requires data migration.'}
                                    </p>
                                    
                                    {originalIsolationLevel === 'shared' && (
                                      <div className="mt-3 p-2 bg-white rounded border border-yellow-300">
                                        <label className="flex items-start space-x-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={removeFromSource}
                                            onChange={(e) => setRemoveFromSource(e.target.checked)}
                                            className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-yellow-300 rounded mt-0.5"
                                          />
                                          <div className="flex-1">
                                            <span className="text-xs font-medium text-yellow-900">
                                              Remove data from shared database after migration
                                            </span>
                                            <p className="text-xs text-yellow-700 mt-1">
                                              A SQL backup file will be created automatically before removal. This helps clean up the shared database.
                                            </p>
                                          </div>
                                        </label>
                                      </div>
                                    )}
                                    
                                    <button
                                      type="button"
                                      onClick={handleMigrate}
                                      disabled={migrating}
                                      className="mt-3 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                    >
                                      {migrating ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          <span>Migrating...</span>
                                        </>
                                      ) : (
                                        <span>Migrate Now</span>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {selectedPlan?.databasePermissions?.allowCustomTables && (
                            <div className="space-y-3">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.databaseConfig?.allowCustomTables || false}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    databaseConfig: {
                                      ...formData.databaseConfig!,
                                      allowCustomTables: e.target.checked,
                                    },
                                  })}
                                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Allow Custom Tables</span>
                              </label>

                              {formData.databaseConfig?.allowCustomTables && (
                                <div className="ml-6">
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Max Custom Tables
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.databaseConfig?.maxCustomTables || ''}
                                    onChange={(e) => setFormData({
                                      ...formData,
                                      databaseConfig: {
                                        ...formData.databaseConfig!,
                                        maxCustomTables: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                      },
                                    })}
                                    className="input-field text-sm"
                                    placeholder={`Max: ${selectedPlan.databasePermissions?.maxCustomTables || 'Unlimited'}`}
                                    min="1"
                                    max={selectedPlan.databasePermissions?.maxCustomTables}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {selectedPlan?.databasePermissions?.allowCustomColumns && (
                            <div className="space-y-3">
                              <label className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.databaseConfig?.allowCustomColumns || false}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    databaseConfig: {
                                      ...formData.databaseConfig!,
                                      allowCustomColumns: e.target.checked,
                                    },
                                  })}
                                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <span className="text-sm font-medium text-gray-700">Allow Custom Columns</span>
                              </label>

                              {formData.databaseConfig?.allowCustomColumns && (
                                <div className="ml-6">
                                  <label className="block text-xs text-gray-600 mb-1">
                                    Max Custom Columns per Table
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.databaseConfig?.maxCustomColumns || ''}
                                    onChange={(e) => setFormData({
                                      ...formData,
                                      databaseConfig: {
                                        ...formData.databaseConfig!,
                                        maxCustomColumns: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                      },
                                    })}
                                    className="input-field text-sm"
                                    placeholder={`Max: ${selectedPlan.databasePermissions?.maxCustomColumns || 'Unlimited'}`}
                                    min="1"
                                    max={selectedPlan.databasePermissions?.maxCustomColumns}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {selectedPlan?.databasePermissions?.allowCustomMigrations && (
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.databaseConfig?.allowCustomMigrations || false}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  databaseConfig: {
                                    ...formData.databaseConfig!,
                                    allowCustomMigrations: e.target.checked,
                                  },
                                })}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                              />
                              <span className="text-sm font-medium text-gray-700">Allow Custom Migrations</span>
                            </label>
                          )}


                          {formData.databaseConfig?.isolationLevel === 'database' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Database URL (optional - will be provisioned automatically)
                              </label>
                              <input
                                type="text"
                                value={formData.databaseConfig?.databaseUrl || ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  databaseConfig: {
                                    ...formData.databaseConfig!,
                                    databaseUrl: e.target.value || undefined,
                                  },
                                })}
                                className="input-field text-sm"
                                placeholder="postgresql://user:pass@host:port/dbname"
                              />
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Storage Configuration Section */}
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5 text-primary-600" />
                <h3 className="text-lg font-semibold text-gray-900">Storage Configuration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStorageConfig(!showStorageConfig)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {showStorageConfig ? 'Hide' : 'Show'} Storage Settings
              </button>
            </div>

            {showStorageConfig && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                {loadingStorageEngines ? (
                  <div className="text-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">Loading storage engines...</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Storage Engine *
                      </label>
                      <select
                        value={storageConfig?.storageEngineId || ''}
                        onChange={(e) => {
                          const selectedEngine = storageEngines.find(eng => eng.id === e.target.value);
                          if (selectedEngine) {
                            setStorageConfig({
                              storageEngineId: selectedEngine.id,
                              config: selectedEngine.defaultConfig ? { ...selectedEngine.defaultConfig } : {},
                              storageEngine: selectedEngine,
                            });
                          } else {
                            setStorageConfig(null);
                          }
                        }}
                        className="input-field"
                      >
                        <option value="">Select storage engine</option>
                        {storageEngines.map((engine) => (
                          <option key={engine.id} value={engine.id}>
                            {engine.name} {engine.description && `- ${engine.description}`}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {(() => {
                          const engine = storageConfig?.storageEngineId 
                            ? storageEngines.find(e => e.id === storageConfig.storageEngineId) || storageConfig.storageEngine
                            : null;
                          if (engine?.type === 's3') return 'Configure AWS S3 credentials and bucket settings';
                          if (engine?.type === 'azure') return 'Configure Azure Blob Storage account and container';
                          if (engine?.type === 'local') return 'Configure local file system storage path';
                          return 'Select a storage engine to configure';
                        })()}
                      </p>
                    </div>

                    {storageConfig?.storageEngineId && (() => {
                      // Find the storage engine from the list if not in config
                      const engine = storageEngines.find(e => e.id === storageConfig.storageEngineId) || storageConfig.storageEngine;
                      const engineType = engine?.type;
                      
                      return (
                        <div className="space-y-4 pl-6 border-l-2 border-primary-200">
                          {engineType === 's3' && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Access Key ID *
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.accessKeyId as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, accessKeyId: e.target.value },
                                })}
                                className="input-field"
                                placeholder="AKIAIOSFODNN7EXAMPLE"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Secret Access Key *
                              </label>
                              <input
                                type="password"
                                value={(storageConfig.config?.secretAccessKey as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, secretAccessKey: e.target.value },
                                })}
                                className="input-field"
                                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Region *
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.region as string) || 'us-east-1'}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, region: e.target.value },
                                })}
                                className="input-field"
                                placeholder="us-east-1"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bucket Name *
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.bucket as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, bucket: e.target.value },
                                })}
                                className="input-field"
                                placeholder="my-bucket"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Endpoint (optional - for S3-compatible services)
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.endpoint as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, endpoint: e.target.value || undefined },
                                })}
                                className="input-field"
                                placeholder="https://s3.amazonaws.com"
                              />
                            </div>
                          </div>
                        )}

                          {engineType === 'azure' && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Name *
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.accountName as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, accountName: e.target.value },
                                })}
                                className="input-field"
                                placeholder="mystorageaccount"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Key *
                              </label>
                              <input
                                type="password"
                                value={(storageConfig.config?.accountKey as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, accountKey: e.target.value },
                                })}
                                className="input-field"
                                placeholder="Account key"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Container Name *
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.containerName as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, containerName: e.target.value },
                                })}
                                className="input-field"
                                placeholder="my-container"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Connection String (optional - alternative to account name/key)
                              </label>
                              <input
                                type="text"
                                value={(storageConfig.config?.connectionString as string) || ''}
                                onChange={(e) => setStorageConfig({
                                  ...storageConfig,
                                  config: { ...storageConfig.config, connectionString: e.target.value || undefined },
                                })}
                                className="input-field"
                                placeholder="DefaultEndpointsProtocol=https;AccountName=..."
                              />
                            </div>
                          </div>
                        )}

                          {engineType === 'local' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Base Path *
                            </label>
                            <input
                              type="text"
                              value={(storageConfig.config?.basePath as string) || './storage'}
                              onChange={(e) => setStorageConfig({
                                ...storageConfig,
                                config: { ...storageConfig.config, basePath: e.target.value },
                              })}
                              className="input-field"
                              placeholder="./storage"
                              required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Local file system path for storing files (for development/testing)
                            </p>
                          </div>
                          )}

                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                            <p className="font-medium mb-1">Note:</p>
                            <p>
                              {client?.id 
                                ? 'This configuration will override the default storage engine for this client. A storage folder will be created automatically.'
                                : 'This configuration will override the default storage engine. A storage folder will be created when the tenant is created.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`btn-primary ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {client?.id ? 'Update Tenant' : 'Create Tenant'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

