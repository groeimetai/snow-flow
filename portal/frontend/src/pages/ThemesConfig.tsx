import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader, Upload, Palette, Image } from 'lucide-react';

interface Theme {
  id?: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  logo?: string; // URL to uploaded logo
  logoFile?: File; // File to upload
  active?: boolean;
}

export default function ThemesConfig() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentTheme, setCurrentTheme] = useState<Theme>({
    name: 'Custom Theme',
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981',
      accent: '#F59E0B',
      background: '#1F2937',
      text: '#F3F4F6'
    }
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadThemes();
  }, []);

  async function loadThemes() {
    try {
      const response = await fetch('/api/themes', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);

        // Load active theme
        const activeTheme = data.themes.find((t: Theme) => t.active);
        if (activeTheme) {
          setCurrentTheme(activeTheme);
          if (activeTheme.logo) {
            setLogoPreview(activeTheme.logo);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load themes:', err);
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo must be smaller than 2MB');
        return;
      }

      setCurrentTheme({ ...currentTheme, logoFile: file });

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append('name', currentTheme.name);
      formData.append('colors', JSON.stringify(currentTheme.colors));

      if (currentTheme.logoFile) {
        formData.append('logo', currentTheme.logoFile);
      }

      const response = await fetch('/api/themes', {
        method: currentTheme.id ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setSaved(true);
        setCurrentTheme({ ...currentTheme, id: data.id, logo: data.logoUrl });
        await loadThemes(); // Reload themes list
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save theme');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(themeId: string) {
    try {
      const response = await fetch(`/api/themes/${themeId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        }
      });

      if (response.ok) {
        await loadThemes();
      }
    } catch (err) {
      setError('Failed to activate theme');
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Theme Customization</h1>
        <p className="text-gray-600">
          Customize SnowCode IDE appearance with your company's branding.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme Editor */}
        <div className="space-y-6">
          {/* Theme Name */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Palette className="w-5 h-5 mr-2" />
              Theme Editor
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme Name
                </label>
                <input
                  type="text"
                  value={currentTheme.name}
                  onChange={(e) => setCurrentTheme({ ...currentTheme, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Acme Corp Dark Theme"
                />
              </div>

              {/* Color Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={currentTheme.colors.primary}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, primary: e.target.value }
                      })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentTheme.colors.primary}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, primary: e.target.value }
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={currentTheme.colors.secondary}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, secondary: e.target.value }
                      })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentTheme.colors.secondary}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, secondary: e.target.value }
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accent Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={currentTheme.colors.accent}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, accent: e.target.value }
                      })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentTheme.colors.accent}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, accent: e.target.value }
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Background Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={currentTheme.colors.background}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, background: e.target.value }
                      })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentTheme.colors.background}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, background: e.target.value }
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Text Color
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={currentTheme.colors.text}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, text: e.target.value }
                      })}
                      className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={currentTheme.colors.text}
                      onChange={(e) => setCurrentTheme({
                        ...currentTheme,
                        colors: { ...currentTheme.colors, text: e.target.value }
                      })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Image className="w-5 h-5 mr-2" />
              Company Logo
            </h2>

            <div className="space-y-4">
              {logoPreview ? (
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-32 mx-auto object-contain"
                  />
                  <button
                    onClick={() => {
                      setLogoPreview(null);
                      setCurrentTheme({ ...currentTheme, logoFile: undefined });
                    }}
                    className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Click to upload logo</p>
                  <p className="text-xs text-gray-500">PNG, JPG, SVG up to 2MB</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              )}

              <p className="text-xs text-gray-500">
                Logo will be displayed in the SnowCode IDE status bar and welcome screen.
                Recommended size: 200x50px (transparent background).
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={loading || !currentTheme.name}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                'Save Theme'
              )}
            </button>
          </div>
        </div>

        {/* Theme Preview & Saved Themes */}
        <div className="space-y-6">
          {/* Preview */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Preview</h2>

            <div
              className="border rounded-lg overflow-hidden"
              style={{ backgroundColor: currentTheme.colors.background }}
            >
              {/* Header Bar */}
              <div
                className="p-3 flex items-center space-x-2"
                style={{ backgroundColor: currentTheme.colors.primary }}
              >
                {logoPreview && (
                  <img src={logoPreview} alt="Logo" className="h-6" />
                )}
                <span
                  className="font-semibold text-sm"
                  style={{ color: currentTheme.colors.text }}
                >
                  SnowCode IDE
                </span>
              </div>

              {/* Editor Area */}
              <div className="p-4 space-y-2">
                <div
                  className="text-xs font-mono"
                  style={{ color: currentTheme.colors.text }}
                >
                  <span style={{ color: currentTheme.colors.secondary }}>function</span>{' '}
                  <span style={{ color: currentTheme.colors.accent }}>example</span>() {'{'}
                </div>
                <div
                  className="text-xs font-mono pl-4"
                  style={{ color: currentTheme.colors.text }}
                >
                  <span style={{ color: currentTheme.colors.secondary }}>return</span>{' '}
                  <span style={{ color: currentTheme.colors.accent }}>'Hello World'</span>;
                </div>
                <div
                  className="text-xs font-mono"
                  style={{ color: currentTheme.colors.text }}
                >
                  {'}'}
                </div>
              </div>

              {/* Status Bar */}
              <div
                className="p-2 flex items-center justify-between text-xs"
                style={{
                  backgroundColor: currentTheme.colors.secondary,
                  color: currentTheme.colors.text
                }}
              >
                <span>Ready</span>
                <span>{currentTheme.name}</span>
              </div>
            </div>
          </div>

          {/* Saved Themes */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Saved Themes</h2>

            {themes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No themes saved yet. Create your first theme above!
              </p>
            ) : (
              <div className="space-y-3">
                {themes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`border rounded-lg p-3 cursor-pointer hover:border-blue-500 transition ${
                      theme.active ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setCurrentTheme(theme)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {theme.logo && (
                          <img src={theme.logo} alt={theme.name} className="h-5" />
                        )}
                        <span className="font-medium text-sm">{theme.name}</span>
                      </div>
                      {theme.active && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex space-x-1">
                      {Object.values(theme.colors).map((color, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    {!theme.active && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActivate(theme.id!);
                        }}
                        className="mt-2 w-full px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                      >
                        Activate Theme
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
