/**
 * Theme Export Utility
 *
 * Exports enterprise theme configuration for use in desktop/console apps.
 * Generates CSS variable overrides that can be applied to the UI.
 */

import fs from "fs"
import path from "path"
import os from "os"

// Theme configuration interface
interface EnterpriseTheme {
  source: 'service-integrator' | 'custom-theme'
  themeId?: number
  themeName?: string
  displayName?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  brandName?: string
  logoUrl?: string
  faviconUrl?: string
  whiteLabelEnabled?: boolean
  supportEmail?: string
  supportUrl?: string
  footerText?: string
  themeConfig?: any
}

interface EnterpriseConfig {
  theme?: EnterpriseTheme
  [key: string]: any
}

/**
 * Load enterprise configuration from disk
 */
export function loadEnterpriseConfig(): EnterpriseConfig | null {
  try {
    const configPath = path.join(os.homedir(), ".snow-code", "enterprise.json")
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"))
    }
  } catch (e) {
    // Ignore errors
  }
  return null
}

/**
 * Get the current enterprise theme
 */
export function getEnterpriseTheme(): EnterpriseTheme | null {
  const config = loadEnterpriseConfig()
  return config?.theme || null
}

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  hex = hex.replace(/^#/, "")
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  }
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex)
  const lighten = (v: number) => Math.min(255, Math.floor(v + (255 - v) * percent))
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex)
  const darken = (v: number) => Math.max(0, Math.floor(v * (1 - percent)))
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`
}

/**
 * Generate CSS variable overrides for the theme
 * These can be injected into the desktop/console app to apply custom colors
 */
export function generateCssVariables(theme: EnterpriseTheme): string {
  const { primaryColor, secondaryColor, accentColor } = theme
  const { r: pr, g: pg, b: pb } = hexToRgb(primaryColor)
  const { r: sr, g: sg, b: sb } = hexToRgb(secondaryColor)
  const { r: ar, g: ag, b: ab } = hexToRgb(accentColor)

  return `
/* Snow-Flow Enterprise Theme Override */
/* Source: ${theme.source} */
/* Brand: ${theme.brandName || 'Snow-Flow'} */

:root {
  /* Primary color scale */
  --theme-primary: ${primaryColor};
  --theme-primary-rgb: ${pr}, ${pg}, ${pb};
  --theme-primary-light: ${lightenColor(primaryColor, 0.2)};
  --theme-primary-lighter: ${lightenColor(primaryColor, 0.4)};
  --theme-primary-dark: ${darkenColor(primaryColor, 0.2)};
  --theme-primary-darker: ${darkenColor(primaryColor, 0.4)};

  /* Secondary color scale */
  --theme-secondary: ${secondaryColor};
  --theme-secondary-rgb: ${sr}, ${sg}, ${sb};
  --theme-secondary-light: ${lightenColor(secondaryColor, 0.2)};
  --theme-secondary-dark: ${darkenColor(secondaryColor, 0.2)};

  /* Accent color scale */
  --theme-accent: ${accentColor};
  --theme-accent-rgb: ${ar}, ${ag}, ${ab};
  --theme-accent-light: ${lightenColor(accentColor, 0.2)};
  --theme-accent-dark: ${darkenColor(accentColor, 0.2)};

  /* Surface colors using theme */
  --surface-brand-base: ${primaryColor};
  --surface-brand-hover: ${darkenColor(primaryColor, 0.1)};
  --surface-brand-active: ${darkenColor(primaryColor, 0.2)};

  /* Interactive colors */
  --surface-interactive-base: ${lightenColor(primaryColor, 0.85)};
  --surface-interactive-hover: ${lightenColor(primaryColor, 0.75)};
  --surface-interactive-active: ${lightenColor(primaryColor, 0.65)};

  /* Success/accent colors */
  --surface-success-base: ${accentColor};
  --surface-success-muted: ${lightenColor(accentColor, 0.8)};

  /* Text on primary */
  --text-on-brand: #ffffff;
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --surface-interactive-base: ${darkenColor(primaryColor, 0.7)};
    --surface-interactive-hover: ${darkenColor(primaryColor, 0.6)};
    --surface-interactive-active: ${darkenColor(primaryColor, 0.5)};
    --surface-success-muted: ${darkenColor(accentColor, 0.7)};
  }
}
`.trim()
}

/**
 * Generate a Shiki-compatible theme object with custom colors
 */
export function generateShikiTheme(theme: EnterpriseTheme): object {
  return {
    name: "snow-flow-enterprise",
    displayName: theme.brandName || "Snow-Flow Enterprise",
    type: "dark",
    colors: {
      "editor.background": "transparent",
      "editor.foreground": "var(--text-base)",
      "editor.selectionBackground": `${theme.primaryColor}40`,
      "editorCursor.foreground": theme.primaryColor,
      "editorLineNumber.foreground": "var(--text-muted)",
      "editorLineNumber.activeForeground": theme.primaryColor,
      "menu.background": "var(--surface-base)",
      "menu.foreground": "var(--text-base)",
      "menu.selectionBackground": `${theme.primaryColor}30`,
      "scrollbar.shadow": "transparent",
      "scrollbarSlider.background": "var(--surface-tertiary)",
      "scrollbarSlider.hoverBackground": "var(--surface-quaternary)",
      "scrollbarSlider.activeBackground": theme.primaryColor
    },
    semanticHighlighting: true,
    tokenColors: [
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: "var(--syntax-comment)" }
      },
      {
        scope: ["string", "string.quoted"],
        settings: { foreground: theme.accentColor }
      },
      {
        scope: ["keyword", "storage.type", "storage.modifier"],
        settings: { foreground: theme.primaryColor }
      },
      {
        scope: ["entity.name.function", "support.function"],
        settings: { foreground: theme.secondaryColor }
      },
      {
        scope: ["variable", "entity.name.variable"],
        settings: { foreground: "var(--syntax-variable)" }
      },
      {
        scope: ["constant.numeric", "constant.language"],
        settings: { foreground: theme.accentColor }
      }
    ]
  }
}

/**
 * Export theme configuration to a JSON file
 */
export function exportThemeJson(outputPath?: string): string | null {
  const theme = getEnterpriseTheme()
  if (!theme) return null

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    theme: theme,
    css: generateCssVariables(theme),
    shiki: generateShikiTheme(theme)
  }

  const output = JSON.stringify(exportData, null, 2)

  if (outputPath) {
    fs.writeFileSync(outputPath, output)
  }

  return output
}

/**
 * Export theme CSS to a file
 */
export function exportThemeCss(outputPath?: string): string | null {
  const theme = getEnterpriseTheme()
  if (!theme) return null

  const css = generateCssVariables(theme)

  if (outputPath) {
    fs.writeFileSync(outputPath, css)
  }

  return css
}

/**
 * Get theme metadata for display
 */
export function getThemeMetadata(): {
  isLoaded: boolean
  source?: string
  brandName?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  whiteLabelEnabled?: boolean
} {
  const theme = getEnterpriseTheme()
  if (!theme) {
    return { isLoaded: false }
  }

  return {
    isLoaded: true,
    source: theme.source,
    brandName: theme.brandName,
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    accentColor: theme.accentColor,
    whiteLabelEnabled: theme.whiteLabelEnabled
  }
}

// Export for use in other modules
export type { EnterpriseTheme }
