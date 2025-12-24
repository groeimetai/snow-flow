#!/usr/bin/env bun
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)
import { $ } from "bun"

// Read package.json dynamically to avoid cached imports
const pkgPath = path.join(dir, "package.json")
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
console.log(`Building with version: ${pkg.version}`)

// Core package path (for MCP servers)
const corePackagePath = path.resolve(dir, "../core")

import { Script } from "@groeimetai/snow-flow-script"

const GOARCH: Record<string, string> = {
  arm64: "arm64",
  x64: "amd64",
  "x64-baseline": "amd64",
}

// Check if we should build for a specific platform (from GitHub Actions)
const targetOS = process.env.TARGET_OS
const targetArch = process.env.TARGET_ARCH

const allTargets = [
  ["windows", "x64"],
  ["linux", "arm64"],
  ["linux", "x64"],
  ["linux", "x64-baseline"],
  ["darwin", "x64"],
  ["darwin", "x64-baseline"],
  ["darwin", "arm64"],
]

// If TARGET_OS and TARGET_ARCH are set, only build that platform
const targets = targetOS && targetArch
  ? [[targetOS, targetArch]]
  : allTargets

await $`rm -rf dist`

const binaries: Record<string, string> = {}
for (const [os, arch] of targets) {
  console.log(`building ${os}-${arch}`)
  // Use unscoped snow-flow as base name for binary packages (works with OIDC)
  const name = `snow-flow-${os}-${arch}`
  await $`mkdir -p dist/${name}/bin`
  await $`CGO_ENABLED=0 GOOS=${os} GOARCH=${GOARCH[arch]} go build -ldflags="-s -w -X main.Version=${pkg.version}" -o ../snowcode/dist/${name}/bin/tui ../tui/cmd/snowcode/snowcode/main.go`
    .cwd("../tui")
    .quiet()

  const watcher = `@parcel/watcher-${os === "windows" ? "win32" : os}-${arch.replace("-baseline", "")}${os === "linux" ? "-glibc" : ""}`
  await $`mkdir -p ../../node_modules/${watcher}`
  await $`npm pack npm pack ${watcher}`.cwd(path.join(dir, "../../node_modules")).quiet()
  await $`tar -xf ../../node_modules/${watcher.replace("@parcel/", "parcel-")}-*.tgz -C ../../node_modules/${watcher} --strip-components=1`

  await Bun.build({
    sourcemap: "external",
    compile: {
      target: `bun-${os}-${arch}` as any,
      outfile: `dist/${name}/bin/snow-code`,
      execArgv: [`--user-agent=snowcode/${pkg.version}`, `--env-file=""`, `--`],
      windows: {},
    },
    entrypoints: ["./src/index.ts"],
    define: {
      SNOWCODE_VERSION: `'${pkg.version}'`,  // Use package.json version
      SNOWCODE_CHANNEL: `'${Script.channel}'`,
      SNOWCODE_TUI_PATH: `'../../../dist/${name}/bin/tui'`,
    },
  })

  // Make binary executable (non-Windows platforms)
  if (os !== "windows") {
    await $`chmod +x dist/${name}/bin/snow-code`
  }

  await $`rm -rf ./dist/${name}/bin/tui`

  // Create postinstall script for non-Windows platforms to set binary permissions
  if (os !== "windows") {
    const postinstallScript = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Make this platform's binary executable after install
try {
  const binaryPath = path.join(__dirname, 'bin', 'snow-code');

  if (fs.existsSync(binaryPath)) {
    fs.chmodSync(binaryPath, 0o755);
    console.log('✅ Made snow-code binary executable');
  }
} catch (error) {
  // Silently fail - permissions might be set already
}
`
    await Bun.file(`dist/${name}/postinstall.cjs`).write(postinstallScript)
  }

  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: pkg.version,  // Use package.json version, not Script.version
        os: [os === "windows" ? "win32" : os],
        cpu: [arch],
        repository: {
          type: "git",
          url: "https://github.com/groeimetai/snow-flow"
        },
        ...(os !== "windows" && {
          scripts: {
            postinstall: "node postinstall.cjs || true"
          }
        })
      },
      null,
      2,
    ),
  )
  binaries[name] = pkg.version
}

// Bundle MCP servers (shared across all platforms)
console.log("Bundling MCP servers...")

// Create MCP directory structure
await $`mkdir -p dist/mcp/enterprise-proxy`

// Bundle enterprise proxy as a standalone Node.js script
// This needs to be a regular JS file that can be run with `node`
console.log("Bundling enterprise-proxy MCP server...")
const enterpriseProxyResult = await Bun.build({
  entrypoints: [path.join(corePackagePath, "src/mcp/enterprise-proxy/index.ts")],
  outdir: path.join(dir, "dist/mcp/enterprise-proxy"),
  target: "node",
  format: "esm",
  minify: false,
  sourcemap: "external",
  external: [
    // Don't bundle native modules that can't be bundled
  ],
  define: {
    "process.env.SNOW_FLOW_VERSION": `"${pkg.version}"`,
  },
})

if (!enterpriseProxyResult.success) {
  console.error("Failed to bundle enterprise-proxy:", enterpriseProxyResult.logs)
} else {
  console.log("✅ Enterprise proxy bundled successfully")
}

// Also bundle the server.ts variant (some code references server.js)
console.log("Bundling enterprise-proxy server variant...")
const enterpriseProxyServerResult = await Bun.build({
  entrypoints: [path.join(corePackagePath, "src/mcp/enterprise-proxy/server.ts")],
  outdir: path.join(dir, "dist/mcp/enterprise-proxy"),
  target: "node",
  format: "esm",
  minify: false,
  sourcemap: "external",
  define: {
    "process.env.SNOW_FLOW_VERSION": `"${pkg.version}"`,
  },
})

if (!enterpriseProxyServerResult.success) {
  console.error("Failed to bundle enterprise-proxy server:", enterpriseProxyServerResult.logs)
} else {
  console.log("✅ Enterprise proxy server variant bundled successfully")
}

// Bundle ServiceNow MCP server (optional, for local development)
const servicenowMcpPath = path.join(corePackagePath, "src/mcp/start-servicenow-mcp.ts")
if (fs.existsSync(servicenowMcpPath)) {
  console.log("Bundling ServiceNow MCP server...")
  await $`mkdir -p dist/mcp/servicenow`

  const servicenowMcpResult = await Bun.build({
    entrypoints: [servicenowMcpPath],
    outdir: path.join(dir, "dist/mcp/servicenow"),
    target: "node",
    format: "esm",
    minify: false,
    sourcemap: "external",
    define: {
      "process.env.SNOW_FLOW_VERSION": `"${pkg.version}"`,
    },
  })

  if (!servicenowMcpResult.success) {
    console.error("Failed to bundle ServiceNow MCP:", servicenowMcpResult.logs)
  } else {
    console.log("✅ ServiceNow MCP bundled successfully")
  }
}

// Bundle ServiceNow Unified MCP server (required for .mcp.json servicenow-unified)
const servicenowUnifiedMcpPath = path.join(corePackagePath, "src/mcp/servicenow-mcp-unified/index.ts")
if (fs.existsSync(servicenowUnifiedMcpPath)) {
  console.log("Bundling ServiceNow Unified MCP server...")
  await $`mkdir -p dist/mcp/servicenow-mcp-unified`

  const servicenowUnifiedMcpResult = await Bun.build({
    entrypoints: [servicenowUnifiedMcpPath],
    outdir: path.join(dir, "dist/mcp/servicenow-mcp-unified"),
    target: "node",
    format: "esm",
    minify: false,
    sourcemap: "external",
    define: {
      "process.env.SNOW_FLOW_VERSION": `"${pkg.version}"`,
    },
  })

  if (!servicenowUnifiedMcpResult.success) {
    console.error("Failed to bundle ServiceNow Unified MCP:", servicenowUnifiedMcpResult.logs)
  } else {
    console.log("✅ ServiceNow Unified MCP bundled successfully")
  }
} else {
  console.warn("⚠️ ServiceNow Unified MCP not found at:", servicenowUnifiedMcpPath)
}

console.log("MCP servers bundled successfully!")

export { binaries }
