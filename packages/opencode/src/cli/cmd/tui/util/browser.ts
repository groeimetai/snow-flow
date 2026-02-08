/**
 * Try to open a URL in the user's browser.
 * Tries multiple strategies:
 *  1. $BROWSER env var (set by Codespaces / Gitpod / custom setups)
 *  2. Platform-native: open (macOS), cmd /c start (Windows), xdg-open (Linux)
 */
export async function tryOpenBrowser(url: string): Promise<boolean> {
  const { spawn } = await import("child_process")

  const trySpawn = (cmd: string, args: string[]): Promise<boolean> =>
    new Promise((resolve) => {
      try {
        const proc = spawn(cmd, args, { detached: true, stdio: "ignore" })
        if (proc.unref) proc.unref()
        proc.on("error", () => resolve(false))
        // Give the process a moment to fail, then assume success
        setTimeout(() => resolve(true), 200)
      } catch {
        resolve(false)
      }
    })

  // 1. Try $BROWSER env var (Codespaces, Gitpod, etc.)
  const browserEnv = process.env.BROWSER
  if (browserEnv) {
    const opened = await trySpawn(browserEnv, [url])
    if (opened) return true
  }

  // 2. Platform-native
  if (process.platform === "darwin") return trySpawn("open", [url])
  if (process.platform === "win32") return trySpawn("cmd", ["/c", "start", url])
  return trySpawn("xdg-open", [url])
}
