#!/usr/bin/env node
/**
 * Scaffold a new plugin package from templates/minimal.
 *   node scripts/new-plugin.mjs <plugin-name>
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const name = process.argv[2]
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: node scripts/new-plugin.mjs <plugin-name>  (lowercase letters, digits, hyphens)')
  process.exit(1)
}
const dest = join(ROOT, 'packages', name)
if (existsSync(dest)) {
  console.error(`packages/${name} already exists`)
  process.exit(1)
}
mkdirSync(dest, { recursive: true })
cpSync(join(ROOT, 'templates', 'minimal'), dest, { recursive: true })

// rewrite template placeholders
for (const f of ['package.json', 'cordis.patch.yml', 'client.js', 'README.md']) {
  const p = join(dest, f)
  if (!existsSync(p)) continue
  let t = readFileSync(p, 'utf8')
  t = t.replaceAll('<name>', name)
  t = t.replaceAll('@chengrp/<name>', `@chengrp/${name}`)
  writeFileSync(p, t)
}
console.log(`created packages/${name} — next: edit it, then run node scripts/validate.mjs`)
