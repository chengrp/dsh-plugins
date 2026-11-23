#!/usr/bin/env node
/**
 * Pack one plugin package into a DSH-installable .tgz with a flat `package/`
 * root (what DSH's plugin manager expects). Dependency-free.
 *   node scripts/pack.mjs packages/prompt-library
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync, existsSync, cpSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const arg = process.argv[2]
if (!arg) {
  console.error('usage: node scripts/pack.mjs packages/<plugin-name>')
  process.exit(1)
}
const dir = resolve(ROOT, arg)
const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))

const stage = join(tmpdir(), `dsh-pack-${Date.now()}`)
const packageDir = join(stage, 'package')
mkdirSync(packageDir, { recursive: true })

// package.json is always required by DSH; never rely on the files list for it.
cpSync(join(dir, 'package.json'), join(packageDir, 'package.json'))
const files = (manifest.files ?? ['index.js', 'client.js', 'cordis.patch.yml', 'locale', 'docs', 'icon.svg'])
  .filter((f) => f !== 'package.json')
for (const f of files) {
  const src = join(dir, f)
  if (f.includes('*')) {
    const sub = f.split('/')[0]
    if (existsSync(join(dir, sub))) cpSync(join(dir, sub), join(packageDir, sub), { recursive: true })
    continue
  }
  if (existsSync(src)) cpSync(src, join(packageDir, f), { recursive: true })
  else console.warn(`  ! skipped missing file: ${f}`)
}

const outName = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`
const out = join(ROOT, outName)
execFileSync('tar', ['-czf', out, '-C', stage, 'package'], { stdio: 'inherit' })
rmSync(stage, { recursive: true, force: true })
console.log(`\npacked: ${out}`)
