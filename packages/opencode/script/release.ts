#!/usr/bin/env bun

import { $ } from "bun"

import pkg from "../package.json"

const version = `0.0.0-${Date.now()}`

const ARCH = {
  arm64: "arm64",
  x64: "amd64",
}

const OS = {
  linux: "linux",
  darwin: "mac",
  win32: "windows",
}

const targets = [
  ["linux", "arm64"],
  ["linux", "x64"],
  ["darwin", "x64"],
  ["darwin", "arm64"],
  ["windows", "x64"],
]

await $`rm -rf dist`

const optionalDependencies: Record<string, string> = {}
for (const [os, arch] of targets) {
  console.log(`building ${os}-${arch}`)
  const name = `${pkg.name}-${os}-${arch}`
  await $`mkdir -p dist/${name}/bin`
  await $`bun build --compile --minify --target=bun-${os}-${arch} --outfile=dist/${name}/bin/${pkg.name} ./src/index.ts`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version,
        os: [os],
        cpu: [arch],
      },
      null,
      2,
    ),
  )
  await $`cd dist/${name} && npm publish --access public --tag latest`
  optionalDependencies[name] = version
}

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name + "-ai",
      bin: {
        [pkg.name]: `./bin/${pkg.name}.mjs`,
      },
      version,
      optionalDependencies,
    },
    null,
    2,
  ),
)
await $`cd ./dist/${pkg.name} && npm publish --access public --tag latest`
