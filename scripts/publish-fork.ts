#!/usr/bin/env bun
import { $ } from "bun"
import * as fs from "fs"
import * as path from "path"

const rawVersion = process.env.PUBLISH_VERSION || "0.0.0"
const scope = "@anjanpoonacha"

// Extract version - handle various formats
let version = rawVersion.replace(/^v/, "").replace(/-anjan$/, "")
if (!version.match(/^\d+\.\d+\.\d+/)) {
  console.error(`Invalid version format: "${rawVersion}". Expected: 1.2.10`)
  const { stdout } = await $`git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.1-anjan"`.quiet()
  version = stdout.toString().trim().replace(/^v/, "").replace(/-anjan$/, "")
}

console.log(`Publishing ${scope}/opencode@${version}`)

const distDir = path.join(process.cwd(), "dist", "publish", "opencode")

// Check multiple possible locations for the CLI binary
const possiblePaths = [
  path.join(process.cwd(), "packages", "opencode", "dist", "opencode-darwin-arm64"),
  path.join(process.cwd(), "cli-dist", "opencode-darwin-arm64"),
]
const cliDistDir = possiblePaths.find(p => fs.existsSync(path.join(p, "bin", "opencode"))) 
  || possiblePaths[0]

// Clean and create dist directory
await $`rm -rf ${distDir}`
await $`mkdir -p ${distDir}/bin`

// Copy the built binary
const binarySource = path.join(cliDistDir, "bin", "opencode")
if (!fs.existsSync(binarySource)) {
  console.error(`Binary not found at ${binarySource}`)
  process.exit(1)
}

await $`cp ${binarySource} ${distDir}/bin/opencode`
await $`chmod +x ${distDir}/bin/opencode`

// Simple package - binary directly included
const pkg = {
  name: `${scope}/opencode`,
  version,
  description: "OpenCode fork with subagent chat fix - AI coding agent for the terminal",
  bin: { opencode: "./bin/opencode" },
  os: ["darwin"],
  cpu: ["arm64"],
  license: "MIT",
  repository: {
    type: "git",
    url: "https://github.com/anjanpoonacha/opencode"
  },
  keywords: ["opencode", "ai", "cli", "coding", "assistant"]
}

await Bun.write(`${distDir}/package.json`, JSON.stringify(pkg, null, 2))

console.log(`Publishing ${scope}/opencode@${version}...`)
await $`cd ${distDir} && npm publish --access public`

console.log(`\nSuccess! Install with:`)
console.log(`  bun i -g ${scope}/opencode`)
console.log(`  # or`)
console.log(`  npm i -g ${scope}/opencode`)
