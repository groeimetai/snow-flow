import z from "zod/v4"
import { EOL } from "os"
import fs from "fs"
import path from "path"
import os from "os"
import { NamedError } from "../util/error"

// Theme configuration interface (matches EnterpriseTheme in auth-enterprise.ts)
interface ThemeConfig {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  brandName?: string
}

// Cache for loaded theme
let cachedTheme: ThemeConfig | null = null
let themeLoaded = false

/**
 * Load theme from enterprise config if available
 */
function loadTheme(): ThemeConfig | null {
  if (themeLoaded) return cachedTheme

  try {
    const configPath = path.join(os.homedir(), ".snow-code", "enterprise.json")
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
      if (config.theme) {
        cachedTheme = {
          primaryColor: config.theme.primaryColor || "#3b82f6",
          secondaryColor: config.theme.secondaryColor || "#1e40af",
          accentColor: config.theme.accentColor || "#10b981",
          brandName: config.theme.brandName
        }
      }
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  themeLoaded = true
  return cachedTheme
}

/**
 * Convert hex color to ANSI 256 color code
 * Uses approximate color matching for terminal compatibility
 */
function hexToAnsi256(hex: string): number {
  // Remove # if present
  hex = hex.replace(/^#/, "")

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Convert to ANSI 256 color cube (6x6x6 = 216 colors, plus 24 grayscale)
  // Color cube starts at index 16, ends at 231
  // Formula: 16 + (36 × r) + (6 × g) + b where r,g,b are 0-5
  const ri = Math.round(r / 255 * 5)
  const gi = Math.round(g / 255 * 5)
  const bi = Math.round(b / 255 * 5)

  return 16 + (36 * ri) + (6 * gi) + bi
}

/**
 * Create ANSI escape sequence for 256-color foreground
 */
function ansi256Fg(colorCode: number): string {
  return `\x1b[38;5;${colorCode}m`
}

export namespace UI {
  const LOGO = [
    [`    ▲  ▲        `, `█▀▀▀ █▀▀▄ █▀▀█ █   █   █▀▀▀ █    █▀▀█ █   █`],
    [`   ▲ ▼▲ ▼▲      `, `▀▀▀█ █  █ █  █ █ █ █ ─ █▀▀  █    █  █ █ █ █`],
    [`  ▲ ▼  ▼  ▼     `, `▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀▀   ▀    ▀▀▀▀ ▀▀▀▀ ▀▀▀▀▀`],
  ]

  export const CancelledError = NamedError.create("UICancelledError", z.void())

  // Default styles (fallback when no theme)
  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
    TEXT_DIM: "\x1b[90m",
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[93m",
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
    TEXT_DANGER: "\x1b[91m",
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
    TEXT_SUCCESS: "\x1b[92m",
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
    TEXT_INFO: "\x1b[94m",
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
  }

  /**
   * Get theme-aware styles
   * Uses enterprise theme colors if available, falls back to defaults
   */
  export function getThemedStyle(): typeof Style & {
    TEXT_PRIMARY: string
    TEXT_PRIMARY_BOLD: string
    TEXT_SECONDARY: string
    TEXT_SECONDARY_BOLD: string
    TEXT_ACCENT: string
    TEXT_ACCENT_BOLD: string
  } {
    const theme = loadTheme()

    if (theme) {
      const primaryAnsi = ansi256Fg(hexToAnsi256(theme.primaryColor))
      const secondaryAnsi = ansi256Fg(hexToAnsi256(theme.secondaryColor))
      const accentAnsi = ansi256Fg(hexToAnsi256(theme.accentColor))

      return {
        ...Style,
        // Override highlight with primary color
        TEXT_HIGHLIGHT: primaryAnsi,
        TEXT_HIGHLIGHT_BOLD: primaryAnsi + "\x1b[1m",
        // Add themed colors
        TEXT_PRIMARY: primaryAnsi,
        TEXT_PRIMARY_BOLD: primaryAnsi + "\x1b[1m",
        TEXT_SECONDARY: secondaryAnsi,
        TEXT_SECONDARY_BOLD: secondaryAnsi + "\x1b[1m",
        TEXT_ACCENT: accentAnsi,
        TEXT_ACCENT_BOLD: accentAnsi + "\x1b[1m",
        // Use accent for success
        TEXT_SUCCESS: accentAnsi,
        TEXT_SUCCESS_BOLD: accentAnsi + "\x1b[1m",
      }
    }

    // Return defaults with placeholder themed colors
    return {
      ...Style,
      TEXT_PRIMARY: Style.TEXT_HIGHLIGHT,
      TEXT_PRIMARY_BOLD: Style.TEXT_HIGHLIGHT_BOLD,
      TEXT_SECONDARY: Style.TEXT_INFO,
      TEXT_SECONDARY_BOLD: Style.TEXT_INFO_BOLD,
      TEXT_ACCENT: Style.TEXT_SUCCESS,
      TEXT_ACCENT_BOLD: Style.TEXT_SUCCESS_BOLD,
    }
  }

  /**
   * Get the current theme (if loaded)
   */
  export function getTheme(): ThemeConfig | null {
    return loadTheme()
  }

  /**
   * Get brand name from theme or default
   */
  export function getBrandName(): string {
    const theme = loadTheme()
    return theme?.brandName || "SNOW-FLOW"
  }

  /**
   * Clear cached theme (useful for testing or after login)
   */
  export function clearThemeCache(): void {
    cachedTheme = null
    themeLoaded = false
  }

  export function println(...message: string[]) {
    print(...message)
    Bun.stderr.write(EOL)
  }

  export function print(...message: string[]) {
    blank = false
    Bun.stderr.write(message.join(" "))
  }

  let blank = false
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  export function logo(pad?: string) {
    const result = []
    for (const row of LOGO) {
      if (pad) result.push(pad)
      result.push(Bun.color("gray", "ansi"))
      result.push(row[0])
      result.push("\x1b[0m")
      result.push(row[1])
      result.push(EOL)
    }
    return result.join("").trimEnd()
  }

  export function logoEnterprise(status: string = "Connected") {
    const result = []
    const theme = loadTheme()
    const themedStyle = getThemedStyle()

    // Use theme primary color for logo text if available
    const logoColor = theme ? themedStyle.TEXT_PRIMARY : "\x1b[0m"

    for (const row of LOGO) {
      result.push("   ")
      result.push(Bun.color("gray", "ansi"))
      result.push(row[0])
      result.push(logoColor)
      result.push(row[1])
      result.push(Style.TEXT_NORMAL)
      result.push(EOL)
    }

    // Show brand name if white-labeled, otherwise "ENTERPRISE"
    const brandText = theme?.brandName
      ? theme.brandName.toUpperCase().split("").join(" ")
      : "E N T E R P R I S E"
    const padding = " ".repeat(Math.max(0, 34 - Math.floor(brandText.length / 2)))

    result.push("   ")
    result.push(Style.TEXT_DIM)
    result.push(padding + brandText)
    result.push(Style.TEXT_NORMAL)
    result.push(EOL)
    result.push("   ")
    result.push(themedStyle.TEXT_SUCCESS)
    result.push(padding + "✓ " + status)
    result.push(Style.TEXT_NORMAL)
    return result.join("").trimEnd()
  }

  export function logoPortal(status: string = "Authenticated") {
    const result = []
    for (const row of LOGO) {
      result.push("   ")
      result.push(Bun.color("gray", "ansi"))
      result.push(row[0])
      result.push("\x1b[0m")
      result.push(row[1])
      result.push(EOL)
    }
    result.push("   ")
    result.push(Style.TEXT_DIM)
    result.push("                                      P O R T A L")
    result.push(Style.TEXT_NORMAL)
    result.push(EOL)
    result.push("   ")
    result.push(Style.TEXT_SUCCESS)
    result.push("                                      ✓ " + status)
    result.push(Style.TEXT_NORMAL)
    return result.join("").trimEnd()
  }

  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  export function error(message: string) {
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function markdown(text: string): string {
    return text
  }
}
