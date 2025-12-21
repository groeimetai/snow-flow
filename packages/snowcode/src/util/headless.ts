/**
 * Headless Environment Detection Utility
 * Detects if running in an environment where browser auto-open won't work
 */

export interface HeadlessEnvironment {
  isHeadless: boolean
  type: 'ssh' | 'docker' | 'codespaces' | 'gitpod' | 'ci' | 'remote' | 'wsl' | 'none'
  reason: string
}

/**
 * Comprehensive headless environment detection
 * Detects SSH, Docker, CI/CD, Codespaces, and other environments where browser auto-open won't work
 */
export function detectHeadlessEnvironment(): HeadlessEnvironment {
  // GitHub Codespaces
  if (process.env.CODESPACES === 'true' || (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)) {
    return { isHeadless: true, type: 'codespaces', reason: 'GitHub Codespaces detected' }
  }

  // Gitpod
  if (process.env.GITPOD_WORKSPACE_ID || process.env.GITPOD_INSTANCE_ID) {
    return { isHeadless: true, type: 'gitpod', reason: 'Gitpod workspace detected' }
  }

  // SSH connection
  if (process.env.SSH_CLIENT || process.env.SSH_CONNECTION || process.env.SSH_TTY) {
    return { isHeadless: true, type: 'ssh', reason: 'SSH connection detected' }
  }

  // Docker container (check for .dockerenv or cgroup)
  try {
    const fs = require('fs')
    if (fs.existsSync('/.dockerenv')) {
      return { isHeadless: true, type: 'docker', reason: 'Docker container detected' }
    }
    // Check cgroup for container runtime
    if (fs.existsSync('/proc/1/cgroup')) {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
      if (cgroup.includes('docker') || cgroup.includes('kubepods') || cgroup.includes('containerd')) {
        return { isHeadless: true, type: 'docker', reason: 'Container environment detected' }
      }
    }
  } catch {
    // Ignore filesystem errors
  }

  // CI/CD environments
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI ||
      process.env.JENKINS_HOME || process.env.CIRCLECI || process.env.TRAVIS) {
    return { isHeadless: true, type: 'ci', reason: 'CI/CD environment detected' }
  }

  // VS Code Remote / DevContainers
  if (process.env.REMOTE_CONTAINERS || process.env.VSCODE_REMOTE_CONTAINERS_SESSION) {
    return { isHeadless: true, type: 'remote', reason: 'VS Code Remote Container detected' }
  }

  // DevPod
  if (process.env.DEVPOD) {
    return { isHeadless: true, type: 'remote', reason: 'DevPod detected' }
  }

  // WSL without display
  if (process.env.WSL_DISTRO_NAME && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return { isHeadless: true, type: 'wsl', reason: 'WSL without display detected' }
  }

  // Linux without display server
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    // Additional check: if we're in a TTY-only environment
    if (process.env.TERM && !process.env.XDG_CURRENT_DESKTOP) {
      return { isHeadless: true, type: 'remote', reason: 'Linux terminal without display server' }
    }
  }

  return { isHeadless: false, type: 'none', reason: '' }
}

/**
 * Check if browser can be auto-opened
 */
export function canAutoOpenBrowser(): boolean {
  return !detectHeadlessEnvironment().isHeadless
}
