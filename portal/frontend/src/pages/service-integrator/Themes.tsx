import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import { CustomTheme, CreateCustomThemeDto, UpdateCustomThemeDto, ThemeUsageStats } from '../../types';

interface ThemeWithStats {
  theme: CustomTheme;
  usage?: ThemeUsageStats;
}

export default function ServiceIntegratorThemes() {
  const { serviceIntegratorSession } = useAuth();
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<CustomTheme | null>(null);
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [error, setError] = useState<string>('');

  // Form state for create/edit
  const [formData, setFormData] = useState<CreateCustomThemeDto>({
    themeName: '',
    displayName: '',
    description: '',
    primaryColor: '#0070AD',
    secondaryColor: '#00CFFF',
    accentColor: '#FFB81C',
    isDefault: false,
    themeConfig: {
      name: '',
      colors: {
        primary: '#0070AD',
        secondary: '#00CFFF',
        accent: '#FFB81C',
        background: '#FFFFFF',
        foreground: '#000000'
      }
    }
  });

  useEffect(() => {
    fetchThemes();
  }, [filter]);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      setError('');
      const themesData = await apiClient.getSIThemes(filter === 'active');
      setThemes(themesData);
    } catch (err: any) {
      console.error('Error fetching themes:', err);
      setError(err.response?.data?.error || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Validate theme name format
      if (!/^[a-z0-9_-]+$/.test(formData.themeName)) {
        setError('Theme name must contain only lowercase letters, numbers, hyphens, and underscores');
        return;
      }

      // Validate hex colors
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!hexColorRegex.test(formData.primaryColor)) {
        setError('Primary color must be a valid hex color (e.g., #0070AD)');
        return;
      }

      // Update themeConfig with current colors
      const themeData: CreateCustomThemeDto = {
        ...formData,
        themeConfig: {
          name: formData.displayName,
          colors: {
            primary: formData.primaryColor,
            secondary: formData.secondaryColor || formData.primaryColor,
            accent: formData.accentColor || formData.primaryColor,
            background: '#FFFFFF',
            foreground: '#000000'
          }
        }
      };

      await apiClient.createSITheme(themeData);
      setShowCreateModal(false);
      resetForm();
      fetchThemes();
    } catch (err: any) {
      console.error('Error creating theme:', err);
      setError(err.response?.data?.error || 'Failed to create theme');
    }
  };

  const handleEditTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTheme) return;

    setError('');

    try {
      const updates: UpdateCustomThemeDto = {
        displayName: formData.displayName,
        description: formData.description,
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        accentColor: formData.accentColor,
        isDefault: formData.isDefault,
        themeConfig: {
          name: formData.displayName,
          colors: {
            primary: formData.primaryColor,
            secondary: formData.secondaryColor || formData.primaryColor,
            accent: formData.accentColor || formData.primaryColor,
            background: '#FFFFFF',
            foreground: '#000000'
          }
        }
      };

      await apiClient.updateSITheme(selectedTheme.id, updates);
      setShowEditModal(false);
      setSelectedTheme(null);
      resetForm();
      fetchThemes();
    } catch (err: any) {
      console.error('Error updating theme:', err);
      setError(err.response?.data?.error || 'Failed to update theme');
    }
  };

  const handleDeleteTheme = async () => {
    if (!selectedTheme) return;

    setError('');

    try {
      await apiClient.deleteSITheme(selectedTheme.id);
      setShowDeleteConfirm(false);
      setSelectedTheme(null);
      fetchThemes();
    } catch (err: any) {
      console.error('Error deleting theme:', err);
      setError(err.response?.data?.error || 'Failed to delete theme');
    }
  };

  const handleSetDefaultTheme = async (theme: CustomTheme) => {
    setError('');

    try {
      await apiClient.setSIDefaultTheme(theme.id);
      fetchThemes();
    } catch (err: any) {
      console.error('Error setting default theme:', err);
      setError(err.response?.data?.error || 'Failed to set default theme');
    }
  };

  const openEditModal = (theme: CustomTheme) => {
    setSelectedTheme(theme);
    setFormData({
      themeName: theme.themeName,
      displayName: theme.displayName,
      description: theme.description || '',
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor || '',
      accentColor: theme.accentColor || '',
      isDefault: theme.isDefault,
      themeConfig: theme.themeConfig
    });
    setShowEditModal(true);
  };

  const openDeleteConfirm = (theme: CustomTheme) => {
    setSelectedTheme(theme);
    setShowDeleteConfirm(true);
  };

  const resetForm = () => {
    setFormData({
      themeName: '',
      displayName: '',
      description: '',
      primaryColor: '#0070AD',
      secondaryColor: '#00CFFF',
      accentColor: '#FFB81C',
      isDefault: false,
      themeConfig: {
        name: '',
        colors: {
          primary: '#0070AD',
          secondary: '#00CFFF',
          accent: '#FFB81C',
          background: '#FFFFFF',
          foreground: '#000000'
        }
      }
    });
    setError('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading themes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Custom Themes</h1>
          <p className="mt-2 text-gray-600">
            Create branded SnowCode CLI experiences for your customers
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
          Create Theme
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex space-x-2">
          {(['all', 'active'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Card>

      {/* Themes List */}
      {themes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No themes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first custom theme.
            </p>
            <div className="mt-6">
              <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
                Create Theme
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {themes.map((theme) => (
            <Card key={theme.id}>
              <div className="space-y-4">
                {/* Theme Header */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {theme.displayName}
                      </h3>
                      {theme.isDefault && (
                        <Badge variant="success">Default</Badge>
                      )}
                      {!theme.isActive && (
                        <Badge variant="warning">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 font-mono">
                      {theme.themeName}
                    </p>
                    {theme.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {theme.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Color Preview */}
                <div className="flex items-center space-x-2">
                  <div className="text-sm font-medium text-gray-500">Colors:</div>
                  <div className="flex space-x-2">
                    <div
                      className="w-8 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: theme.primaryColor }}
                      title={`Primary: ${theme.primaryColor}`}
                    />
                    {theme.secondaryColor && (
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{ backgroundColor: theme.secondaryColor }}
                        title={`Secondary: ${theme.secondaryColor}`}
                      />
                    )}
                    {theme.accentColor && (
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{ backgroundColor: theme.accentColor }}
                        title={`Accent: ${theme.accentColor}`}
                      />
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">Created:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(theme.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Updated:</span>
                    <span className="ml-2 text-gray-900">
                      {new Date(theme.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(theme)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Edit
                    </button>
                    {!theme.isDefault && (
                      <button
                        onClick={() => handleSetDefaultTheme(theme)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => openDeleteConfirm(theme)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Theme Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title="Create Custom Theme"
      >
        <form onSubmit={handleCreateTheme} className="space-y-4">
          <Input
            label="Theme Name (identifier)"
            value={formData.themeName}
            onChange={(e) => setFormData({ ...formData, themeName: e.target.value.toLowerCase() })}
            placeholder="e.g., capgemini, accenture"
            required
            helperText="Lowercase letters, numbers, hyphens, and underscores only"
          />
          <Input
            label="Display Name"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="e.g., Capgemini, Accenture"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Brief description of this theme"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Color
              </label>
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="w-full h-10 rounded border border-gray-300"
                required
              />
              <input
                type="text"
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                placeholder="#0070AD"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Color
              </label>
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                className="w-full h-10 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                placeholder="#00CFFF"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accent Color
              </label>
              <input
                type="color"
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="w-full h-10 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
                placeholder="#FFB81C"
              />
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="isDefault" className="ml-2 block text-sm text-gray-900">
              Set as default theme for new customers
            </label>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowCreateModal(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit">Create Theme</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Theme Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedTheme(null); resetForm(); }}
        title="Edit Theme"
      >
        <form onSubmit={handleEditTheme} className="space-y-4">
          <Input
            label="Display Name"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Color
              </label>
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="w-full h-10 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Secondary Color
              </label>
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                className="w-full h-10 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accent Color
              </label>
              <input
                type="color"
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="w-full h-10 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded font-mono"
              />
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefaultEdit"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="isDefaultEdit" className="ml-2 block text-sm text-gray-900">
              Set as default theme for new customers
            </label>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowEditModal(false); setSelectedTheme(null); resetForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setSelectedTheme(null); }}
        title="Delete Theme"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the theme "{selectedTheme?.displayName}"?
            This action cannot be undone.
          </p>
          {selectedTheme?.isDefault && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ⚠️ This is your default theme. You should set another theme as default before deleting this one.
              </p>
            </div>
          )}
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowDeleteConfirm(false); setSelectedTheme(null); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteTheme}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Theme
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
