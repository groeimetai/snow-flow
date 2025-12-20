#!/usr/bin/env bun
/**
 * Resolve catalog: and workspace: dependencies for npm publishing
 *
 * npm doesn't support Bun's catalog: protocol, so we need to resolve
 * these references to concrete versions before publishing.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const rootDir = join(import.meta.dir, '../../..')
const packageDir = join(import.meta.dir, '..')

function resolveCatalog() {
  // Read root package.json for catalog definitions
  const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
  const catalog = rootPkg.workspaces?.catalog || {}

  // Read package.json
  const pkgPath = join(packageDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

  let changed = false

  // Helper to resolve catalog: references
  const resolveDeps = (deps: Record<string, string> | undefined) => {
    if (!deps) return
    for (const [name, version] of Object.entries(deps)) {
      if (version === 'catalog:') {
        if (catalog[name]) {
          deps[name] = catalog[name]
          changed = true
          console.log(`✓ Resolved ${name}: catalog: → ${catalog[name]}`)
        } else {
          console.warn(`⚠ Warning: No catalog entry found for ${name}`)
        }
      }
    }
  }

  // Resolve all dependency sections
  resolveDeps(pkg.dependencies)
  resolveDeps(pkg.devDependencies)
  resolveDeps(pkg.peerDependencies)
  resolveDeps(pkg.optionalDependencies)

  // Also resolve root package.json for workspace context
  const rootPkgCopy = { ...rootPkg }
  resolveDeps(rootPkgCopy.devDependencies)
  resolveDeps(rootPkgCopy.overrides)

  if (changed) {
    // Save resolved package.json
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`\n✓ Resolved catalog references in ${pkgPath}`)
  }

  // Also update root package.json temporarily
  const rootChanged = JSON.stringify(rootPkgCopy.devDependencies) !== JSON.stringify(rootPkg.devDependencies) ||
                      JSON.stringify(rootPkgCopy.overrides) !== JSON.stringify(rootPkg.overrides)

  if (rootChanged) {
    writeFileSync(join(rootDir, 'package.json'), JSON.stringify(rootPkgCopy, null, 2) + '\n')
    console.log(`✓ Resolved catalog references in root package.json`)
  }

  return changed || rootChanged
}

// Run resolution
try {
  const resolved = resolveCatalog()
  if (resolved) {
    console.log('\n✅ Ready for npm publish!')
    console.log('⚠️  Remember to git restore these changes after publishing if you want to keep catalog: references')
  } else {
    console.log('✓ No catalog: references to resolve')
  }
  process.exit(0)
} catch (error) {
  console.error('❌ Failed to resolve catalog references:', error)
  process.exit(1)
}
