#!/usr/bin/env node
/**
 * Validate every plugin package under packages/.
 * Kept dependency-free so it can run in CI and locally with plain `node`.
 * Rules mirror awesome-dsh-plugin's submission checks; see root README.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PKGS = resolve(ROOT, 'packages')
const REPO = 'chengrp/dsh-plugins'

let failures = 0
let count = 0

function fail(pkg, msg) {
  failures++
  console.error(`  ✗ [${pkg}] ${msg}`)
}
function ok(pkg, msg) {
  console.log(`  ✓ [${pkg}] ${msg}`)
}

const dirs = existsSync(PKGS)
  ? readdirSync(PKGS, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : []

if (dirs.length === 0) {
  console.error('no plugin packages found under packages/')
  process.exit(1)
}

for (const name of dirs) {
  count++
  const dir = resolve(PKGS, name)
  const rel = relative(ROOT, dir).replace(/\\/g, '/')
  const label = name
  let manifest
  try {
    manifest = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'))
  } catch (e) {
    fail(label, `cannot read package.json: ${e.message}`)
    continue
  }

  // identity
  if (manifest.name !== `@chengrp/${name}`) fail(label, `name should be @chengrp/${name}, got ${manifest.name}`)
  if (manifest.private) fail(label, 'package.json must not be "private": true')
  if (manifest.license !== 'MIT') fail(label, 'license should be MIT')
  if (manifest.repository?.url !== `git+https://github.com/${REPO}.git`) fail(label, `repository.url should point to ${REPO}`)
  if (manifest.repository?.directory !== rel) fail(label, `repository.directory should be ${rel}`)
  const kws = manifest.keywords ?? []
  if (!kws.includes('dsh-plugin')) fail(label, 'keywords must include dsh-plugin')

  // dsh declarations
  if (!manifest.dsh?.bundle) fail(label, 'dsh.bundle must be declared (market CI rejects client-only)')
  if (!manifest.dsh?.client?.platform) fail(label, 'dsh.client.platform must be declared')

  // exports
  for (const key of ['.', './client', './locale/*.json', './icon']) {
    if (!(key in (manifest.exports ?? {}))) fail(label, `exports must include ${key}`)
  }

  // patch
  const patchPath = resolve(dir, 'cordis.patch.yml')
  if (!existsSync(patchPath)) fail(label, 'cordis.patch.yml is missing')
  else {
    const patch = readFileSync(patchPath, 'utf8')
    if (!patch.includes(`@chengrp/${name}`)) fail(label, `cordis.patch.yml must reference @chengrp/${name}`)
  }

  // client entry
  if (!existsSync(resolve(dir, 'client.js'))) fail(label, 'client.js is missing')

  // locale meta
  let hasMeta = false
  for (const loc of ['zh.json', 'en.json']) {
    const p = resolve(dir, 'locale', loc)
    if (!existsSync(p)) continue
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'))
      if (j.meta?.title && j.meta?.description) hasMeta = true
    } catch (e) {
      fail(label, `locale/${loc} invalid JSON: ${e.message}`)
    }
  }
  if (!hasMeta) fail(label, 'locale/zh.json or en.json needs meta.title + meta.description')

  // icon size
  for (const icon of ['icon.svg', 'icon.png', 'icon.jpg', 'icon.jpeg', 'icon.webp']) {
    const p = resolve(dir, icon)
    if (existsSync(p)) {
      const size = statSync(p).size
      if (size > 256 * 1024) fail(label, `${icon} is ${size} bytes (>256KiB)`)
      break
    }
  }

  if (failures === 0 || true) ok(label, `${rel} checked`)
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${count} package(s), ${failures} error(s).`)
process.exit(failures > 0 ? 1 : 0)
