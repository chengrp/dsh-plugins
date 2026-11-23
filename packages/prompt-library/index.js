/**
 * Host half of @chengrp/prompt-library.
 *
 * Owns the local `prompt-library` storage domain (JSON backend, per-record
 * layout, persisted under the profile's storages directory) and exposes it to
 * the browser half through exact fetch routes under /api/prompt-library.*.
 * Data never leaves this machine.
 */

export const inject = ['connection', 'storageDomain']

/** Structural passthrough schema: records are normalized by the routes below. */
const passthroughSchema = { parse: (value) => value }

const DOMAIN_SPEC = {
  // Must match UNIT_NAME_RE: /^[a-z][a-z0-9_]*$/ — lowercase, digits, underscores.
  name: 'prompt_library',
  version: 1,
  layout: 'per-record',
  invalidRecords: 'backup-and-skip',
  tables: {
    prompts: { valueSchema: passthroughSchema },
  },
}

const KEY_RE = /^[A-Za-z0-9_-]+$/
const TITLE_LIMIT = 200
const TEXT_LIMIT = 100_000
const TAGS_LIMIT = 20
const TAG_LIMIT = 32

const newId = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
})

const badRequest = (message) => json({ error: message }, 400)

async function readJsonBody(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function normalizeTags(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const tags = []
  for (const tag of value) {
    if (typeof tag !== 'string') return null
    const trimmed = tag.trim().slice(0, TAG_LIMIT)
    if (trimmed && !tags.includes(trimmed)) tags.push(trimmed)
    if (tags.length >= TAGS_LIMIT) break
  }
  return tags
}

function validKey(value) {
  return typeof value === 'string' && KEY_RE.test(value) && value.length <= 80
}

export async function apply(ctx) {
  const domain = await ctx.storageDomain.open(DOMAIN_SPEC)
  ctx.effect(() => () => void domain.close(), 'prompt-library: domain')

  const prompts = domain.table('prompts')

  const handlers = {
    // GET — full library snapshot.
    'prompt-library.list': async () => json({
      prompts: [...prompts.entries()].map(([id, record]) => ({ ...record, id })),
    }),

    // POST {id?, title, text, tags} — create or update one prompt.
    'prompt-library.save': async (request) => {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object') return badRequest('invalid body')
      const { title, text, tags } = body
      if (typeof title !== 'string' || !title.trim()) return badRequest('title is required')
      if (typeof text !== 'string' || !text.trim()) return badRequest('text is required')
      const normalizedTags = normalizeTags(tags)
      if (normalizedTags === null) return badRequest('tags must be an array of strings')

      const id = validKey(body.id) ? body.id : null
      const existing = id === null ? undefined : prompts.get(id)
      const now = Date.now()
      const record = {
        title: title.trim().slice(0, TITLE_LIMIT),
        text: text.slice(0, TEXT_LIMIT),
        tags: normalizedTags,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        useCount: existing?.useCount ?? 0,
        lastUsedAt: existing?.lastUsedAt ?? null,
      }
      const key = existing ? id : newId()
      await prompts.put(key, record)
      return json({ prompt: { ...record, id: key } })
    },

    // POST {id} — delete one prompt.
    'prompt-library.delete': async (request) => {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object' || !validKey(body.id)) return badRequest('invalid id')
      const removed = await prompts.delete(body.id)
      return json({ removed })
    },

    // POST {id} — record one use (fill or copy); returns the fresh record.
    'prompt-library.use': async (request) => {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object' || !validKey(body.id)) return badRequest('invalid id')
      const now = Date.now()
      try {
        const next = await prompts.update(body.id, (current) => ({
          ...current,
          useCount: (current.useCount ?? 0) + 1,
          lastUsedAt: now,
        }))
        return json({ prompt: { ...next, id: body.id } })
      } catch (error) {
        const message = String(error?.message ?? error)
        if (message.includes('missing-key')) return badRequest('unknown id')
        throw error
      }
    },

    // POST {records: [...]} — bulk merge import; ids are kept when valid and
    // fresh, otherwise minted. Existing records keep their local usage stats.
    'prompt-library.import': async (request) => {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object' || !Array.isArray(body.records)) {
        return badRequest('records array is required')
      }
      if (body.records.length > 2000) return badRequest('too many records (max 2000)')
      const now = Date.now()
      let added = 0
      let updated = 0
      for (const raw of body.records) {
        if (raw === null || typeof raw !== 'object') continue
        if (typeof raw.title !== 'string' || !raw.title.trim()) continue
        if (typeof raw.text !== 'string' || !raw.text.trim()) continue
        const normalizedTags = normalizeTags(raw.tags)
        if (normalizedTags === null) continue
        const id = validKey(raw.id) ? raw.id : newId()
        const existing = prompts.get(id)
        const importedCount = Number.isFinite(raw.useCount) && raw.useCount > 0 ? Math.floor(raw.useCount) : 0
        const importedUsedAt = Number.isFinite(raw.lastUsedAt) && raw.lastUsedAt > 0 ? Math.floor(raw.lastUsedAt) : null
        const importedCreated = Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? Math.floor(raw.createdAt) : now
        await prompts.put(id, {
          title: raw.title.trim().slice(0, TITLE_LIMIT),
          text: raw.text.slice(0, TEXT_LIMIT),
          tags: normalizedTags,
          createdAt: existing?.createdAt ?? importedCreated,
          updatedAt: now,
          useCount: existing?.useCount ?? importedCount,
          lastUsedAt: existing?.lastUsedAt ?? importedUsedAt,
        })
        if (existing) updated += 1
        else added += 1
      }
      return json({ added, updated, total: prompts.size })
    },

    // POST {from, to} — rename (or merge into) a tag across all records.
    'prompt-library.renameTag': async (request) => {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object') return badRequest('invalid body')
      const from = typeof body.from === 'string' ? body.from.trim().slice(0, TAG_LIMIT) : ''
      const to = typeof body.to === 'string' ? body.to.trim().slice(0, TAG_LIMIT) : ''
      if (!from) return badRequest('from is required')
      if (!to) return badRequest('to is required')
      if (from === to) return json({ renamed: 0 })
      let renamed = 0
      for (const [id, record] of prompts.entries()) {
        if (!Array.isArray(record.tags) || !record.tags.includes(from)) continue
        const next = record.tags.filter((tag) => tag !== from)
        if (!next.includes(to)) next.push(to)
        await prompts.update(id, (current) => ({ ...current, tags: next, updatedAt: Date.now() }))
        renamed += 1
      }
      return json({ renamed })
    },

    // POST {tag} — strip one tag from every record.
    'prompt-library.deleteTag': async (request) => {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object') return badRequest('invalid body')
      const tag = typeof body.tag === 'string' ? body.tag.trim().slice(0, TAG_LIMIT) : ''
      if (!tag) return badRequest('tag is required')
      let removed = 0
      for (const [id, record] of prompts.entries()) {
        if (!Array.isArray(record.tags) || !record.tags.includes(tag)) continue
        const next = record.tags.filter((t) => t !== tag)
        await prompts.update(id, (current) => ({ ...current, tags: next, updatedAt: Date.now() }))
        removed += 1
      }
      return json({ removed })
    },
  }

  await Promise.all(Object.entries(handlers).map(async ([action, handler]) => {
    await ctx.connection.fetch.register({
      path: `/api/${action}`,
      methods: action.endsWith('.list') ? ['GET'] : ['POST'],
      requestBody: 'buffered',
      fetch: handler,
    })
  }))
}
