'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationService } from '@/lib/notifications';
import { Plus, X, Loader } from 'lucide-react';
import AuthenticatedImage from './AuthenticatedImage';

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

export default function ThemeManagement() {
  const { theme, loading, updateTheme, refreshTheme } = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [customThemes, setCustomThemes] = useState<ThemeTemplate[]>([]);
  const [saving, setSaving] = useState(false);

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
      await updateTheme({
        colors: selectedTheme.colors,
        themeName: selectedTheme.name,
      });
      notificationService.success('Theme applied successfully');
      await refreshTheme();
    } catch (error: any) {
      notificationService.error(error.message || 'Failed to apply theme');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Loader className="h-12 w-12 text-indigo-600 animate-spin" />
          <p className="text-gray-600">Loading theme...</p>
        </div>
      </div>
    );
  }

  const allThemes = [...PREDEFINED_THEMES, ...customThemes];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Current Theme Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Current Theme</h2>
            <button
              onClick={() => setShowAddThemeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              Add Theme
            </button>
          </div>

          {theme && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {theme.themeName || 'Enterprise Theme'}
                </h3>
                <button
                  onClick={() => setShowViewConfigModal(true)}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  View Configuration
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Primary Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: theme.colors?.primary || '#4B4CB2' }}
                    />
                    <span className="text-sm font-mono text-gray-700 break-all">
                      {theme.colors?.primary || '#4B4CB2'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Secondary Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: theme.colors?.secondary || '#FF11F7' }}
                    />
                    <span className="text-sm font-mono text-gray-700 break-all">
                      {theme.colors?.secondary || '#FF11F7'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Accent Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: theme.colors?.accent || '#626DFF' }}
                    />
                    <span className="text-sm font-mono text-gray-700 break-all">
                      {theme.colors?.accent || '#626DFF'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Background Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: theme.colors?.background || '#FFFFFF' }}
                    />
                    <span className="text-sm font-mono text-gray-700 break-all">
                      {theme.colors?.background || '#FFFFFF'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Text Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-gray-300 flex-shrink-0"
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

        {/* Theme Customizations Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Theme Customizations</h2>
            <button
              onClick={handleApplyTheme}
              disabled={saving || !selectedThemeId}
              className={`px-6 py-2 rounded-lg transition-colors w-full sm:w-auto ${
                saving || !selectedThemeId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {saving ? 'Applying...' : 'Apply theme'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allThemes.map((themeTemplate) => (
              <div
                key={themeTemplate.id}
                className={`border rounded-lg p-6 transition-all cursor-pointer ${
                  selectedThemeId === themeTemplate.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300'
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
      </div>

      {/* Add Theme Modal */}
      {showAddThemeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add Custom Theme</h2>
              <button
                onClick={() => setShowAddThemeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme Name
                </label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddThemeModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTheme}
                className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add Theme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Configuration Modal */}
      {showViewConfigModal && theme && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Theme Configuration</h2>
              <button
                onClick={() => setShowViewConfigModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
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

              {/* Favicon and Logo Section in Modal */}
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

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowViewConfigModal(false)}
                className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
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
