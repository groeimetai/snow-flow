/**
 * TUI Binary Loader
 * Downloads the Go TUI binary from GitHub Releases on first use
 * Uses Bun APIs for file operations
 *
 * For local development, checks for locally built binaries first
 */

import { join, dirname } from "path"
import { homedir, platform, arch } from "os"
import { mkdir } from "fs/promises"
import { fileURLToPath } from "url"

const TUI_VERSION = "9.0.0"
const GITHUB_REPO = "groeimetai/snow-flow"
const GITHUB_RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/download`

// Get the directory of this file for local dev binary lookup
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface PlatformInfo {
  goos: string
  goarch: string
  extension: string
}

function getPlatformInfo(): PlatformInfo {
  const p = platform()
  const a = arch()

  let goos: string
  let goarch: string
  let extension = ""

  // Map Node.js platform to Go OS
  switch (p) {
    case "darwin":
      goos = "darwin"
      break
    case "linux":
      goos = "linux"
      break
    case "win32":
      goos = "windows"
      extension = ".exe"
      break
    default:
      throw new Error(`Unsupported platform: ${p}`)
  }

  // Map Node.js arch to Go arch
  switch (a) {
    case "arm64":
      goarch = "arm64"
      break
    case "x64":
      goarch = "amd64"
      break
    default:
      throw new Error(`Unsupported architecture: ${a}`)
  }

  return { goos, goarch, extension }
}

function getBinaryName(): string {
  const { goos, goarch, extension } = getPlatformInfo()
  return `snow-flow-tui-${goos}-${goarch}${extension}`
}

function getBinaryPath(): string {
  const binDir = join(homedir(), ".snow-flow", "bin")
  return join(binDir, getBinaryName())
}

function getVersionFilePath(): string {
  return join(homedir(), ".snow-flow", "bin", ".version")
}

/**
 * Get path to locally built snowcode binary (for development)
 * Checks packages/snowcode/dist/ for platform-specific binaries
 */
function getLocalDevBinaryPath(): string | null {
  const { goos, goarch, extension } = getPlatformInfo()

  // Map to snowcode package naming convention
  const archMapping: Record<string, string> = {
    "arm64": "arm64",
    "amd64": "x64"
  }
  const mappedArch = archMapping[goarch] || goarch

  // Build the package name (e.g., @groeimetai/snow-flow-snowcode-darwin-arm64)
  const packageName = `@groeimetai/snow-flow-snowcode-${goos}-${mappedArch}`

  // Look for the binary in various possible locations
  const possiblePaths = [
    // From packages/core/src/tui/ -> packages/snowcode/dist/
    join(__dirname, "..", "..", "..", "snowcode", "dist", packageName, "bin", `snow-code${extension}`),
    // From packages/core/dist/tui/ -> packages/snowcode/dist/
    join(__dirname, "..", "..", "..", "..", "snowcode", "dist", packageName, "bin", `snow-code${extension}`),
    // Monorepo root -> packages/snowcode/dist/
    join(__dirname, "..", "..", "..", "..", "..", "packages", "snowcode", "dist", packageName, "bin", `snow-code${extension}`),
  ]

  for (const path of possiblePaths) {
    const file = Bun.file(path)
    // Use sync check for simplicity (Bun.file doesn't have sync exists)
    try {
      const stat = Bun.spawnSync(["test", "-f", path])
      if (stat.exitCode === 0) {
        return path
      }
    } catch {
      // Continue to next path
    }
  }

  return null
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" })

  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await Bun.write(destPath, arrayBuffer)
}

async function getInstalledVersion(): Promise<string | null> {
  const versionFile = Bun.file(getVersionFilePath())
  const exists = await versionFile.exists()

  if (!exists) {
    return null
  }

  try {
    const version = await versionFile.text()
    return version.trim()
  } catch {
    return null
  }
}

async function setInstalledVersion(version: string): Promise<void> {
  await Bun.write(getVersionFilePath(), version)
}

export async function ensureTUIBinary(): Promise<string> {
  // First, check for local development binaries (for local testing before release)
  const localBinary = getLocalDevBinaryPath()
  if (localBinary) {
    return localBinary
  }

  const binaryPath = getBinaryPath()
  const binDir = join(homedir(), ".snow-flow", "bin")

  // Ensure bin directory exists
  await mkdir(binDir, { recursive: true })

  // Check if binary exists and version matches
  const binaryFile = Bun.file(binaryPath)
  const binaryExists = await binaryFile.exists()

  if (binaryExists) {
    const installedVersion = await getInstalledVersion()
    if (installedVersion === TUI_VERSION) {
      return binaryPath
    }
  }

  // Download from GitHub Releases
  const binaryName = getBinaryName()
  const downloadUrl = `${GITHUB_RELEASE_URL}/v${TUI_VERSION}/${binaryName}`

  try {
    await downloadFile(downloadUrl, binaryPath)

    // Make executable (Bun.spawnSync for chmod)
    if (platform() !== "win32") {
      Bun.spawnSync(["chmod", "+x", binaryPath])
    }

    await setInstalledVersion(TUI_VERSION)
  } catch (error) {
    throw new Error(`Failed to download TUI binary from ${downloadUrl}: ${error}`)
  }

  return binaryPath
}

export function getTUIBinaryPath(): string {
  return getBinaryPath()
}

export async function isTUIInstalled(): Promise<boolean> {
  const binaryFile = Bun.file(getBinaryPath())
  return binaryFile.exists()
}

export { TUI_VERSION }
