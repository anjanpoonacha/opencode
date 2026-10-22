#!/usr/bin/env bun
import { $ } from "bun"
import { existsSync } from "fs"
import path from "path"

// Publishes the fork as a single-binary, darwin-arm64-only npm package under
// @anjanpoonacha/opencode. It wraps the prebuilt v2 CLI binary (from
// `packages/cli/script/build.ts --single --target=opencode-darwin-arm64`) in a
// minimal package.json. No auto-update: the v2 updater only recognizes packages
// named @opencode/cli*, so this package silently no-ops its upgrade check.

const scope = "@anjanpoonacha"
const name = `${scope}/opencode`

const rawVersion = process.env.PUBLISH_VERSION?.trim() || ""
const normalized = rawVersion.replace(/^v/, "").replace(/-anjan$/, "")
const version = /^\d+\.\d+\.\d+/.test(normalized)
  ? normalized
  : (await $`git describe --tags --abbrev=0`.quiet().nothrow().text())
      .trim()
      .replace(/^v/, "")
      .replace(/-anjan$/, "") || "0.0.0"

const dryRun = process.argv.includes("--dry-run")

// v2 build.ts emits dist/<name>/bin/opencode where name = target with "opencode" -> "cli".
// The darwin-arm64 single build therefore lands at dist/cli-darwin-arm64/bin/opencode.
const root = process.env.OPENCODE_CLI_DIST
  ? path.resolve(process.env.OPENCODE_CLI_DIST)
  : path.resolve(process.cwd(), "packages/cli/dist")
const sourceDir = path.join(root, "cli-darwin-arm64")
const binarySource = path.join(sourceDir, "bin", "opencode")

if (!existsSync(binarySource)) {
  console.error(`Binary not found at ${binarySource}`)
  console.error(
    `Build it first: cd packages/cli && bun run script/build.ts --single --target=opencode-darwin-arm64`,
  )
  process.exit(1)
}

const distDir = path.join(process.cwd(), "dist", "publish", "opencode")
await $`rm -rf ${distDir}`
await $`mkdir -p ${distDir}/bin`
await $`cp ${binarySource} ${distDir}/bin/opencode`
await $`chmod +x ${distDir}/bin/opencode`

await Bun.write(
  path.join(distDir, "package.json"),
  JSON.stringify(
    {
      name,
      version,
      description: "OpenCode fork (v2) with subagent chat fix — AI coding agent for the terminal",
      bin: { opencode: "./bin/opencode" },
      os: ["darwin"],
      cpu: ["arm64"],
      license: "MIT",
      repository: { type: "git", url: "https://github.com/anjanpoonacha/opencode" },
      keywords: ["opencode", "ai", "cli", "coding", "assistant"],
    },
    null,
    2,
  ),
)

console.log(`Publishing ${name}@${version}${dryRun ? " (dry-run)" : ""}`)
if (dryRun) {
  await $`npm publish --dry-run --access public`.cwd(distDir)
  process.exit(0)
}
await $`npm publish --access public`.cwd(distDir)
console.log(`\nSuccess! Install with:\n  bun i -g ${name}\n  # or\n  npm i -g ${name}`)
