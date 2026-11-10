'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { notificationService } from '@/lib/notifications';
import { API_ENDPOINTS } from '@/constants/routes';
import { Upload, Image as ImageIcon, Loader, Plus, X } from 'lucide-react';
import type { Theme } from '@/types';
import AuthenticatedImage from './AuthenticatedImage';

interface GlobalThemeManagementProps {
  resetRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

interface ThemeTemplate {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
}

const PREDEFINED_THEMES: ThemeTemplate[] = [
  {
    id: 'enterprise',
    name: 'Enterprise Theme',
    colors: {
      primary: '#4B4CB2',
      secondary: '#FF11F7',
      accent: '#626DFF',
      background: '#FFFFFF',
      text: '#333333',
    },
  },
  {
    id: 'gaming',
    name: 'Gaming Theme',
    colors: {
      primary: '#2E7D32',
      secondary: '#FFC107',
      accent: '#FF5722',
      background: '#000000',
      text: '#FFFFFF',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimalist Theme',
    colors: {
      primary: '#FFFFFF',
      secondary: '#F0F0F0',
      accent: '#000000',
      background: '#E0E0E0',
      text: '#212121',
    },
  },
];

function GlobalThemeManagement({ resetRef }: GlobalThemeManagementProps) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [customThemes, setCustomThemes] = useState<ThemeTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [showAddThemeModal, setShowAddThemeModal] = useState(false);
  const [showViewConfigModal, setShowViewConfigModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColors, setNewThemeColors] = useState({
    primary: '#4B4CB2',
    secondary: '#FF11F7',
    accent: '#626DFF',
    background: '#FFFFFF',
    text: '#333333',
  });

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme) {
      // Find matching predefined theme
      const matchingTheme = PREDEFINED_THEMES.find(
        (t) =>
          t.colors.primary === theme.colors?.primary &&
          t.colors.secondary === theme.colors?.secondary &&
          t.colors.accent === theme.colors?.accent &&
          t.colors.background === theme.colors?.background &&
          t.colors.text === theme.colors?.text
      );
      if (matchingTheme) {
        setSelectedThemeId(matchingTheme.id);
      } else {
        setSelectedThemeId('custom');
      }
    }
  }, [theme]);

  const loadTheme = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Theme>(API_ENDPOINTS.THEME.GLOBAL.BASE);
      setTheme(data);
    } catch (error: any) {
      console.error('Failed to load global theme:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        notificationService.error('You do not have permission to access global theme settings. Super admin access is required.');
      } else {
        notificationService.error('Failed to load global theme');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset the global theme to default? This will affect all clients that haven\'t customized their theme.')) {
      return;
    }
    try {
      setSaving(true);
      await apiClient.post(API_ENDPOINTS.THEME.GLOBAL.RESET);
      notificationService.success('Global theme reset to default');
      await loadTheme();
    } catch (error) {
      console.error('Failed to reset global theme:', error);
      notificationService.error('Failed to reset global theme');
    } finally {
      setSaving(false);
    }
  };

  // Expose handleReset to parent via ref
  useEffect(() => {
    if (resetRef) {
      resetRef.current = handleReset;
    }
  }, [resetRef]);

  const handleApplyTheme = async () => {
    const selectedTheme = [...PREDEFINED_THEMES, ...customThemes].find(
      (t) => t.id === selectedThemeId
    );

    if (!selectedTheme) {
      notificationService.error('Please select a theme to apply');
      return;
    }

    try {
      setSaving(true);
      await apiClient.put(API_ENDPOINTS.THEME.GLOBAL.BASE, {
        colors: selectedTheme.colors,
        themeName: selectedTheme.name,
      });
      notificationService.success('Global theme applied successfully');
      await loadTheme();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to apply global theme');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTheme = () => {
    if (!newThemeName.trim()) {
      notificationService.error('Please enter a theme name');
      return;
    }

    const newTheme: ThemeTemplate = {
      id: `custom-${Date.now()}`,
      name: newThemeName,
      colors: { ...newThemeColors },
    };

    setCustomThemes([...customThemes, newTheme]);
    setShowAddThemeModal(false);
    setNewThemeName('');
    setNewThemeColors({
      primary: '#4B4CB2',
      secondary: '#FF11F7',
      accent: '#626DFF',
      background: '#FFFFFF',
      text: '#333333',
    });
    notificationService.success('Custom theme added successfully');
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) {
      notificationService.error('Please select a file to upload');
      return;
    }

    const file = e.target.files[0];

    if (!file || file.size === 0) {
      notificationService.error('Selected file is empty');
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!validTypes.includes(file.type)) {
      notificationService.error('Invalid file type. Please select an image file (PNG, JPEG, GIF, SVG, or ICO)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      notificationService.error('File size exceeds 2MB limit');
      return;
    }

    setUploadingFavicon(true);
    try {
      const formData = new FormData();
      formData.append('favicon', file, file.name);

      const updated = await apiClient.post<Theme>(
        API_ENDPOINTS.THEME.GLOBAL.UPLOAD_FAVICON,
        formData
      );
      setTheme(updated);
      notificationService.success('Global favicon uploaded successfully');
      await loadTheme();
    } catch (error: any) {
      console.error('Favicon upload failed:', error);
      const errorMessage = error.message || 'Failed to upload favicon';
      notificationService.error(errorMessage);
    } finally {
      setUploadingFavicon(false);
      if (faviconInputRef.current) {
        faviconInputRef.current.value = '';
      }
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) {
      notificationService.error('Please select a file to upload');
      return;
    }

    const file = e.target.files[0];

    if (!file || file.size === 0) {
      notificationService.error('Selected file is empty');
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!validTypes.includes(file.type)) {
      notificationService.error('Invalid file type. Please select an image file (PNG, JPEG, GIF, SVG, or ICO)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notificationService.error('File size exceeds 5MB limit');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file, file.name);

      const updated = await apiClient.post<Theme>(
        API_ENDPOINTS.THEME.GLOBAL.UPLOAD_LOGO,
        formData
      );
      setTheme(updated);
      notificationService.success('Global logo uploaded successfully');
      await loadTheme();
    } catch (error: any) {
      console.error('Logo upload failed:', error);
      const errorMessage = error.message || 'Failed to upload logo';
      notificationService.error(errorMessage);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="card text-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="h-12 w-12 text-primary-600 animate-spin" />
          <p className="text-lg font-medium text-gray-900">Loading global theme settings...</p>
        </div>
      </div>
    );
  }

  const allThemes = [...PREDEFINED_THEMES, ...customThemes];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Global theme settings serve as defaults for all clients. Individual clients can override these settings with their own custom themes. When a client has custom settings, those take precedence over the global theme.
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Current Theme</h2>
        <button
          onClick={() => setShowAddThemeModal(true)}
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center bg-[#4C4DB3]"
        >
          <Plus className="h-4 w-4" />
          Add Theme
        </button>
      </div>
      {/* Current Theme Section */}
      <div className="">
        {theme && (
          <div className="border border-[#4B4CB2] rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {theme.themeName || 'Enterprise Theme'}
              </h3>
              <button
                onClick={() => setShowViewConfigModal(true)}
                className="text-sm  hover:text-indigo-700 border rounded-lg px-4 py-2"
              >
                View Configuration
              </button>
            </div>

            <div className="flex gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Primary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.colors?.primary || '#4B4CB2' }}
                  />
                  <span className="text-sm font-mono text-gray-700 break-all">
                    {theme.colors?.primary || '#4B4CB2'}
                  </span>
                </div>
              </div>

              <div className='w-[1px] h-fill rounded-full bg-gray-300'>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Secondary Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.colors?.secondary || '#FF11F7' }}
                  />
                  <span className="text-sm font-mono text-gray-700 break-all">
                    {theme.colors?.secondary || '#FF11F7'}
                  </span>
                </div>
              </div>

              <div className='w-[1px] h-fill rounded-full bg-gray-300'>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Accent Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.colors?.accent || '#626DFF' }}
                  />
                  <span className="text-sm font-mono text-gray-700 break-all">
                    {theme.colors?.accent || '#626DFF'}
                  </span>
                </div>
              </div>

              <div className='w-[1px] h-fill rounded-full bg-gray-300'>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Background Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.colors?.background || '#FFFFFF' }}
                  />
                  <span className="text-sm font-mono text-gray-700 break-all">
                    {theme.colors?.background || '#FFFFFF'}
                  </span>
                </div>
              </div>

              <div className='w-[1px] h-fill rounded-full bg-gray-300'>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Text Color</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: theme.colors?.text || '#333333' }}
                  />
                  <span className="text-sm font-mono text-gray-700 break-all">
                    {theme.colors?.text || '#333333'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Theme Customizations</h2>
        <button
          onClick={handleApplyTheme}
          disabled={saving || !selectedThemeId}
          className={`px-6 py-2 rounded-lg transition-colors w-full sm:w-auto ${saving || !selectedThemeId
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          {saving ? 'Applying...' : 'Apply theme'}
        </button>
      </div>

      {/* Theme Customizations Section */}
      <div className="">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allThemes.map((themeTemplate) => (
            <div
              key={themeTemplate.id}
              className={`border rounded-lg p-6 transition-all cursor-pointer ${selectedThemeId === themeTemplate.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300 bg-white'
                }`}
              onClick={() => setSelectedThemeId(themeTemplate.id)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{themeTemplate.name}</h3>
                <input
                  type="radio"
                  checked={selectedThemeId === themeTemplate.id}
                  onChange={() => setSelectedThemeId(themeTemplate.id)}
                  className="w-5 h-5 text-indigo-600 cursor-pointer mt-1"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Primary Color</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: themeTemplate.colors.primary }}
                    />
                    <span className="text-xs font-mono text-gray-600">
                      {themeTemplate.colors.primary}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Secondary Color</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: themeTemplate.colors.secondary }}
                    />
                    <span className="text-xs font-mono text-gray-600">
                      {themeTemplate.colors.secondary}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accent Color</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: themeTemplate.colors.accent }}
                    />
                    <span className="text-xs font-mono text-gray-600">
                      {themeTemplate.colors.accent}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Background Color</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: themeTemplate.colors.background }}
                    />
                    <span className="text-xs font-mono text-gray-600">
                      {themeTemplate.colors.background}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Text Color</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: themeTemplate.colors.text }}
                    />
                    <span className="text-xs font-mono text-gray-600">
                      {themeTemplate.colors.text}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Favicon and Logo Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <ImageIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
            <span>Global Favicon</span>
          </h3>
          {theme?.faviconUrl && (
            <div className="flex items-center space-x-3">
              <AuthenticatedImage src={theme.faviconUrl} alt="Favicon Preview" className="h-8 w-8 object-contain" />
              <p className="text-sm text-gray-600">Current Global Favicon</p>
            </div>
          )}
          <input
            type="file"
            ref={faviconInputRef}
            onChange={handleFaviconUpload}
            className="hidden"
            id="favicon-upload"
            accept="image/*"
          />
          <button
            onClick={() => faviconInputRef.current?.click()}
            disabled={uploadingFavicon || saving}
            className={`btn-secondary flex items-center space-x-2 ${uploadingFavicon ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploadingFavicon ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span>{uploadingFavicon ? 'Uploading...' : 'Upload Global Favicon'}</span>
          </button>
          <p className="text-xs text-gray-500">Recommended size: 32x32px or 16x16px. Max 5MB.</p>
        </div>

        <div className="card space-y-4">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <ImageIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
            <span>Global Logo</span>
          </h3>
          {theme?.logoUrl && (
            <div className="flex items-center space-x-3">
              <AuthenticatedImage src={theme.logoUrl} alt="Logo Preview" className="h-12 object-contain" />
              <p className="text-sm text-gray-600">Current Global Logo</p>
            </div>
          )}
          <input
            type="file"
            ref={logoInputRef}
            onChange={handleLogoUpload}
            className="hidden"
            id="logo-upload"
            accept="image/*"
          />
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo || saving}
            className={`btn-secondary flex items-center space-x-2 ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploadingLogo ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            <span>{uploadingLogo ? 'Uploading...' : 'Upload Global Logo'}</span>
          </button>
          <p className="text-xs text-gray-500">Recommended formats: PNG, SVG. Max 5MB.</p>
        </div>
      </div>

      {/* Add Theme Modal */}
      {showAddThemeModal && (
        <div className="modal-overlay" onClick={() => setShowAddThemeModal(false)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Custom Theme</h2>
              <button
                onClick={() => setShowAddThemeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme Name
                </label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., My Custom Theme"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newThemeColors.primary}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, primary: e.target.value })
                      }
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newThemeColors.primary}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, primary: e.target.value })
                      }
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newThemeColors.secondary}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, secondary: e.target.value })
                      }
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newThemeColors.secondary}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, secondary: e.target.value })
                      }
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Accent Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newThemeColors.accent}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, accent: e.target.value })
                      }
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newThemeColors.accent}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, accent: e.target.value })
                      }
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Background Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newThemeColors.background}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, background: e.target.value })
                      }
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newThemeColors.background}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, background: e.target.value })
                      }
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Text Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newThemeColors.text}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, text: e.target.value })
                      }
                      className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newThemeColors.text}
                      onChange={(e) =>
                        setNewThemeColors({ ...newThemeColors, text: e.target.value })
                      }
                      className="input-field flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={() => setShowAddThemeModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTheme}
                className="btn-primary"
              >
                Add Theme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Configuration Modal */}
      {showViewConfigModal && theme && (
        <div className="modal-overlay" onClick={() => setShowViewConfigModal(false)}>
          <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Theme Configuration</h2>
              <button
                onClick={() => setShowViewConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {theme.themeName || 'Enterprise Theme'}
                </h3>
                <p className="text-sm text-gray-600">Current theme configuration</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Primary Color</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: theme.colors?.primary }}
                    />
                    <span className="font-mono text-sm text-gray-900">
                      {theme.colors?.primary}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Secondary Color</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: theme.colors?.secondary }}
                    />
                    <span className="font-mono text-sm text-gray-900">
                      {theme.colors?.secondary}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Accent Color</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: theme.colors?.accent }}
                    />
                    <span className="font-mono text-sm text-gray-900">
                      {theme.colors?.accent}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Background Color</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: theme.colors?.background }}
                    />
                    <span className="font-mono text-sm text-gray-900">
                      {theme.colors?.background}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Text Color</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full border-2 border-gray-300"
                      style={{ backgroundColor: theme.colors?.text }}
                    />
                    <span className="font-mono text-sm text-gray-900">
                      {theme.colors?.text}
                    </span>
                  </div>
                </div>
              </div>

              {(theme?.faviconUrl || theme?.logoUrl) && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Branding Assets</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {theme?.faviconUrl && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Favicon</p>
                        <AuthenticatedImage
                          src={theme.faviconUrl}
                          alt="Favicon"
                          className="h-16 w-16 rounded border border-gray-200"
                        />
                      </div>
                    )}
                    {theme?.logoUrl && (
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Logo</p>
                        <AuthenticatedImage
                          src={theme.logoUrl}
                          alt="Logo"
                          className="h-16 rounded border border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={() => setShowViewConfigModal(false)}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalThemeManagement;
