/**
 * Browser half of @chengrp/prompt-library.
 *
 * Registers two slot entries:
 *  - sidebar.footer.action — the "prompt library" footer button (wide bar:
 *    icon + label; collapsed rail: circular icon) with a fixed panel above it.
 *  - conversation.input.left — compact composer toolbar buttons; the panel
 *    portals to document.body (the docked composer clips fixed children).
 *    Filling splices at the caret through `inputActions.insertText` (lands at
 *    the end when the editor is unfocused — the draft is never clobbered),
 *    and the second button saves the live draft as a new prompt via the
 *    session's standard `useInput` channel.
 *
 * The sidebar panel finds the current main-view session (retainedBy.mainView)
 * and reuses the inputActions registered by the toolbar entry, falling back
 * to clipboard copy when no session composer is mounted. All data flows
 * through the host half's exact fetch routes under /api/prompt-library.*.
 */

window.__ModuleLoader__.load({
  id: '@chengrp/prompt-library',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const h = React.createElement

    const NS = 'prompt-library'

    // sessionId -> InputActions, registered by the composer toolbar entry so
    // the sidebar panel can fill the current main-view session's draft.
    const inputActionsBySession = new Map()

    // ---------- host api ----------

    async function request(path, body) {
      const init = body === undefined
        ? { method: 'GET' }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      const response = await fetch(path, init)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      return data
    }

    const fetchLibrary = () => request('/api/prompt-library.list')
    const savePrompt = (payload) => request('/api/prompt-library.save', payload)
    const deletePrompt = (id) => request('/api/prompt-library.delete', { id })
    const markUsed = (id) => request('/api/prompt-library.use', { id })
    const importPrompts = (records) => request('/api/prompt-library.import', { records })
    const renameTagCall = (from, to) => request('/api/prompt-library.renameTag', { from, to })
    const deleteTagCall = (tag) => request('/api/prompt-library.deleteTag', { tag })

    // ---------- locale ----------

    const DICTIONARIES = {
      zh: {
        'footer.label': '提示词收藏',
        'footer.title': '提示词收藏',
        'panel.title': '提示词收藏',
        'panel.search': '搜索提示词',
        'panel.new': '新建',
        'panel.close': '关闭',
        'panel.sort.use': '常用',
        'panel.sort.recent': '最近',
        'panel.sort.created': '最新',
        'panel.allTags': '全部',
        'panel.moreTags': '展开 {n} 个标签',
        'panel.fewerTags': '收起',
        'preview.created': '创建于 {date}',
        'preview.lastUsed': '上次使用 {time}',
        'preview.chars': '{n} 字',
        'panel.empty': '还没有收藏提示词',
        'panel.emptyHint': '点「新建」把常用提示词存进来',
        'panel.emptyFiltered': '没有匹配的提示词',
        'panel.stats': '共 {count} 条 · 累计使用 {uses} 次',
        'panel.loading': '加载中…',
        'editor.newTitle': '新建提示词',
        'editor.editTitle': '编辑提示词',
        'editor.name': '标题',
        'editor.namePlaceholder': '给这条提示词起个名字',
        'editor.text': '内容',
        'editor.textPlaceholder': '提示词正文，点击条目时填入输入框',
        'editor.tags': '标签',
        'editor.tagsPlaceholder': '用逗号分隔，如：测试, 优化, 翻译',
        'editor.save': '保存',
        'editor.saving': '保存中…',
        'editor.cancel': '取消',
        'editor.nameRequired': '标题不能为空',
        'editor.textRequired': '内容不能为空',
        'action.fill': '填入',
        'action.copy': '复制',
        'action.copied': '已复制',
        'action.edit': '编辑',
        'action.delete': '删除',
        'action.deleteConfirm': '确认',
        'action.uses': '{count} 次',
        'action.neverUsed': '未使用',
        'time.justNow': '刚刚',
        'time.minutesAgo': '{n} 分钟前',
        'time.hoursAgo': '{n} 小时前',
        'time.daysAgo': '{n} 天前',
        'time.longAgo': '很久以前',
        'fill.noTarget': '当前没有可填入的会话，已复制到剪贴板',
        'fill.failed': '输入框暂时不可写入，请重试',
        'action.saveDraft': '存为提示词',
        'action.saveDraftTitle': '把当前输入框内容存为提示词',
        'editor.hint': 'Ctrl/⌘+Enter 保存 · Esc 取消',
        'action.import': '导入',
        'action.export': '导出',
        'action.manageTags': '标签管理',
        'tags.back': '返回',
        'tags.empty': '还没有标签',
        'tags.count': '{n} 条',
        'tags.rename': '重命名',
        'tags.remove': '移除',
        'tags.confirmRemove': '确认移除',
        'import.done': '导入完成：新增 {added} 条，更新 {updated} 条',
        'import.badFile': '无法读取：请选择本插件导出的 JSON 文件',
        'error.retry': '读取失败，点此重试：{message}',
      },
      en: {
        'footer.label': 'Prompts',
        'footer.title': 'Prompt library',
        'panel.title': 'Prompt library',
        'panel.search': 'Search prompts',
        'panel.new': 'New',
        'panel.close': 'Close',
        'panel.sort.use': 'Frequent',
        'panel.sort.recent': 'Recent',
        'panel.sort.created': 'Newest',
        'panel.allTags': 'All',
        'panel.moreTags': 'More ({n})',
        'panel.fewerTags': 'Less',
        'preview.created': 'Created {date}',
        'preview.lastUsed': 'Last used {time}',
        'preview.chars': '{n} chars',
        'panel.empty': 'No prompts yet',
        'panel.emptyHint': 'Click "New" to save your first prompt',
        'panel.emptyFiltered': 'No matching prompts',
        'panel.stats': '{count} prompts · {uses} uses',
        'panel.loading': 'Loading…',
        'editor.newTitle': 'New prompt',
        'editor.editTitle': 'Edit prompt',
        'editor.name': 'Title',
        'editor.namePlaceholder': 'Name this prompt',
        'editor.text': 'Content',
        'editor.textPlaceholder': 'Prompt text; clicking a row fills the composer',
        'editor.tags': 'Tags',
        'editor.tagsPlaceholder': 'Comma separated, e.g. testing, rewrite, i18n',
        'editor.save': 'Save',
        'editor.saving': 'Saving…',
        'editor.cancel': 'Cancel',
        'editor.nameRequired': 'Title is required',
        'editor.textRequired': 'Content is required',
        'action.fill': 'Fill',
        'action.copy': 'Copy',
        'action.copied': 'Copied',
        'action.edit': 'Edit',
        'action.delete': 'Delete',
        'action.deleteConfirm': 'Sure?',
        'action.uses': '{count} uses',
        'action.neverUsed': 'Unused',
        'time.justNow': 'just now',
        'time.minutesAgo': '{n} min ago',
        'time.hoursAgo': '{n} h ago',
        'time.daysAgo': '{n} d ago',
        'time.longAgo': 'long ago',
        'fill.noTarget': 'No active session to fill; copied instead',
        'fill.failed': 'The composer refused the insert; try again',
        'action.saveDraft': 'Save draft as prompt',
        'action.saveDraftTitle': 'Save the current draft as a prompt',
        'editor.hint': 'Ctrl/⌘+Enter save · Esc cancel',
        'action.import': 'Import',
        'action.export': 'Export',
        'action.manageTags': 'Tags',
        'tags.back': 'Back',
        'tags.empty': 'No tags yet',
        'tags.count': '{n} prompts',
        'tags.rename': 'Rename',
        'tags.remove': 'Remove',
        'tags.confirmRemove': 'Sure?',
        'import.done': 'Imported: {added} added, {updated} updated',
        'import.badFile': 'Cannot read that file: pick a JSON exported by this plugin',
        'error.retry': 'Failed to load, click to retry: {message}',
      },
    }

    // ---------- styles (rendered as a React element; unmount removes it) ----------

    const STYLE = `
.pl-layer{position:relative;width:100%;height:42px;margin:8px 0 0}
.pl-layer-rail{width:36px;height:36px;margin:8px auto 0}
.pl-badge{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:calc(100% + 4px);height:42px;margin-left:-2px;padding:0 10px 0 8px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px}
.pl-badge:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.pl-layer-rail .pl-badge{width:36px;height:36px;margin:0;padding:0;border-radius:50%}
.pl-tool{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
.pl-tool:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.pl-panel{position:fixed;isolation:isolate;z-index:30;display:flex;flex-direction:column;width:440px;max-width:calc(100vw - 24px);max-height:min(560px,72vh);overflow:hidden;border-radius:12px;box-shadow:var(--dsw-elevation-prominent);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.5}
.pl-header{display:flex;align-items:center;gap:8px;min-height:44px;padding:10px 12px}
.pl-title{flex:1;min-width:0;font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary)}
.pl-headbtn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;white-space:nowrap}
.pl-headbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.pl-headbtn.pl-primary{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-inverted)}
.pl-headbtn.pl-primary:hover{opacity:.9;background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-inverted)}
.pl-toolbar{display:flex;gap:8px;padding:0 12px 8px}
.pl-search{flex:1;min-width:0;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.pl-search::placeholder{color:var(--dsw-alias-label-tertiary)}
.pl-search:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.pl-sort{height:30px;padding:0 6px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px}
.pl-tags{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 8px}
.pl-chip{height:22px;padding:0 9px;border:1px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px}
.pl-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.pl-chip.pl-on{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:var(--dsw-alias-label-primary-inverted)}
.pl-body{flex:1;overflow-y:auto;padding:0 12px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}
.pl-empty{display:flex;flex-direction:column;align-items:center;gap:4px;padding:28px 0;color:var(--dsw-alias-label-tertiary);font-size:12px;text-align:center}
.pl-empty b{color:var(--dsw-alias-label-secondary);font-weight:500;font-size:13px}
.pl-hint{padding:16px 0;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}
.pl-row{display:flex;flex-direction:column;gap:6px;margin-bottom:8px;padding:12px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px}
.pl-row-head{display:flex;align-items:baseline;gap:8px}
.pl-row-title{flex:1;min-width:0;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-row-meta{flex-shrink:0;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pl-row-tags{display:flex;flex-wrap:wrap;gap:4px}
.pl-tag{height:18px;padding:0 7px;display:inline-flex;align-items:center;border-radius:999px;background:var(--dsw-alias-fill-l2);color:var(--dsw-alias-label-secondary);font-size:10px}
.pl-row-text{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pl-row-actions{display:flex;gap:6px}
.pl-act{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px}
.pl-act:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.pl-act.pl-fill{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-inverted)}
.pl-act.pl-fill:hover{opacity:.9;background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-inverted)}
.pl-act.pl-danger{color:var(--dsw-alias-state-error-primary)}
.pl-act.pl-danger:hover{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-inverted)}
.pl-editor{display:flex;flex-direction:column;gap:8px;padding:2px 12px 12px}
.pl-field{display:flex;flex-direction:column;gap:4px}
.pl-label{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.pl-input,.pl-area{width:100%;padding:6px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.pl-input::placeholder,.pl-area::placeholder{color:var(--dsw-alias-label-tertiary)}
.pl-area{min-height:96px;resize:vertical;font-family:var(--dsw-font-mono)}
.pl-input:focus,.pl-area:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.pl-problem{font-size:11px;color:var(--dsw-alias-state-error-primary)}
.pl-editor-actions{display:flex;gap:8px;justify-content:flex-end}
.pl-error{margin:8px 12px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-state-error-primary);background:transparent;font:inherit;font-size:12px;cursor:pointer;text-align:left;width:calc(100% - 24px)}
.pl-footer{display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l3);font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pl-notice{font-size:11px;color:var(--dsw-alias-label-secondary)}
.pl-tags-measure{position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:100%}
.pl-chip-more{border-style:dashed;color:var(--dsw-alias-label-tertiary)}
.pl-chip-more:hover{color:var(--dsw-alias-label-primary)}
.pl-preview{position:fixed;z-index:40;display:flex;flex-direction:column;gap:8px;width:420px;max-width:calc(100vw - 24px);max-height:min(480px,calc(100vh - 24px));overflow-y:auto;padding:12px;border-radius:12px;box-shadow:var(--dsw-elevation-prominent);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:1.6;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent}
.pl-preview-title{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}
.pl-preview-text{white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary)}
.pl-preview-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pl-tools{display:inline-flex;align-items:center;gap:2px}
.pl-tool:disabled{opacity:.35;cursor:default}
.pl-tool:disabled:hover{background:transparent;color:var(--dsw-alias-label-secondary)}
.pl-footstats{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-footbtn{display:inline-flex;align-items:center;height:22px;padding:0 7px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;font-size:11px;white-space:nowrap}
.pl-footbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.pl-footbtn.pl-on{color:var(--dsw-alias-state-business-primary)}
.pl-mgr-head{padding:0 12px 8px}
.pl-mgr-row{display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px}
.pl-mgr-name{flex:1;min-width:0;font-size:13px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-mgr-count{flex-shrink:0;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.pl-mgr-input{flex:1;min-width:0;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.pl-mgr-input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.pl-editor-hint{flex:1;min-width:0;font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`

    const PlStyle = () => h('style', null, STYLE)

    // ---------- small pieces ----------

    function BookmarkIcon({ size }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinejoin: 'round', strokeLinecap: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M6.5 4.75h11a.75.75 0 0 1 .75.75v14.1L12 16.6l-6.25 3V5.5a.75.75 0 0 1 .75-.75Z' }))
    }

    /** Position a fixed panel just above the trigger, clamped to the viewport. */
    function useAnchorAbove(ref, open, width = 440) {
      const [anchor, setAnchor] = React.useState(null)
      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const rect = ref.current?.getBoundingClientRect()
          if (!rect) return
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
          setAnchor({ left, bottom: window.innerHeight - rect.top + 8 })
        }
        place()
        window.addEventListener('resize', place)
        return () => window.removeEventListener('resize', place)
      }, [open, ref, width])
      return anchor
    }

    /**
     * Close on pointer-down outside our surfaces — the trigger button, the
     * panel, the editor, the hover preview and inline tag renames all carry
     * data-prompt-library, so presses inside any of them (e.g. selecting text
     * in the preview) keep the panel open. Escape closes the hover preview
     * first (its own listener), then the editor / an inline tag rename, and
     * only dismisses the panel when none of them is open.
     */
    function useDismissOnOutside(open, close) {
      React.useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (target && typeof target.closest === 'function' &&
              target.closest('[data-prompt-library]')) return
          close()
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          if (document.querySelector('[data-prompt-library="preview"], [data-prompt-library="editor"], [data-prompt-library="editing"]')) return
          close()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open, close])
    }

    function relativeTime(timestamp, t) {
      if (!timestamp) return null
      const elapsed = Date.now() - timestamp
      const minute = 60_000
      const hour = 60 * minute
      const day = 24 * hour
      if (elapsed < minute) return t('time.justNow')
      if (elapsed < hour) return t('time.minutesAgo', { n: Math.floor(elapsed / minute) })
      if (elapsed < day) return t('time.hoursAgo', { n: Math.floor(elapsed / hour) })
      if (elapsed < 30 * day) return t('time.daysAgo', { n: Math.floor(elapsed / day) })
      return t('time.longAgo')
    }

    function formatDate(timestamp) {
      const d = new Date(timestamp)
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    // ---------- tag filter (one row by default) ----------

    /**
     * Tag chips, collapsed to a single row by default: "All" plus the
     * most-used tags, followed by an expander chip. Row capacity is measured
     * in a hidden clone that carries every chip plus a widest-case expander,
     * so the visible row never wraps or overflows. The active filter chip
     * stays on the collapsed row even when it is a rare tag.
     */
    function TagFilterRow({ t, tags, activeTag, onSelect }) {
      const [expanded, setExpanded] = React.useState(false)
      const [limit, setLimit] = React.useState(tags.length)
      const measureRef = React.useRef(null)

      React.useLayoutEffect(() => {
        const measure = measureRef.current
        if (!measure) return
        if (expanded) { setLimit(tags.length); return }
        const els = Array.from(measure.children)
        for (const el of els) el.style.display = ''
        const top0 = els[0].offsetTop
        const last = els[els.length - 1]
        let k = els.length - 2 // last tag chip (before the expander)
        while (k >= 1 && last.offsetTop !== top0) { els[k].style.display = 'none'; k -= 1 }
        let visible = 0
        for (let i = 1; i < els.length - 1; i += 1) if (els[i].style.display !== 'none') visible += 1
        for (const el of els) el.style.display = ''
        setLimit(visible)
      }, [expanded, tags, t])

      const collapsed = !expanded
      const visibleTags = collapsed ? tags.slice(0, limit) : tags
      let shownTags = visibleTags
      if (collapsed && activeTag !== null && !visibleTags.some(([tag]) => tag === activeTag)) {
        const active = tags.find(([tag]) => tag === activeTag)
        if (active) shownTags = [active, ...visibleTags.slice(0, Math.max(0, limit - 1))]
      }
      const hiddenCount = collapsed ? tags.length - Math.min(limit, tags.length) : 0

      return h(React.Fragment, null,
        h('div', {
          ref: measureRef, className: 'pl-tags pl-tags-measure', 'aria-hidden': 'true',
        },
          h('button', { type: 'button', className: 'pl-chip', tabIndex: -1 }, t('panel.allTags')),
          tags.map(([tag, count]) =>
            h('button', { type: 'button', key: tag, className: 'pl-chip', tabIndex: -1 }, `${tag} · ${count}`)),
          h('button', { type: 'button', className: 'pl-chip', tabIndex: -1 },
            t('panel.moreTags', { n: tags.length }))),
        h('div', { className: 'pl-tags' },
          h('button', {
            type: 'button',
            className: activeTag === null ? 'pl-chip pl-on' : 'pl-chip',
            onClick: () => onSelect(null),
          }, t('panel.allTags')),
          shownTags.map(([tag, count]) =>
            h('button', {
              type: 'button', key: tag,
              className: activeTag === tag ? 'pl-chip pl-on' : 'pl-chip',
              onClick: () => onSelect(activeTag === tag ? null : tag),
            }, `${tag} · ${count}`)),
          expanded || hiddenCount > 0
            ? h('button', {
                type: 'button', className: 'pl-chip pl-chip-more',
                'aria-expanded': String(expanded),
                onClick: () => setExpanded((value) => !value),
              }, expanded ? t('panel.fewerTags') : t('panel.moreTags', { n: hiddenCount }))
            : null))
    }

    // ---------- hover preview ----------

    /**
     * Fixed hover card with the prompt's full text and usage attributes.
     * Portals to the document body (both panel flavors clip fixed children);
     * placement is two-phase — render hidden, measure, then position beside
     * the row, clamped to the viewport. Hovering into the card keeps it open
     * so long texts can be scrolled.
     */
    function PromptPreview({ t, prompt, anchorRect, onMouseEnter, onMouseLeave, onRequestClose }) {
      const ref = React.useRef(null)
      const [pos, setPos] = React.useState(null)

      React.useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const vw = window.innerWidth
        const vh = window.innerHeight
        const w = el.offsetWidth
        const hgt = el.offsetHeight
        let left = anchorRect.right + 10
        if (left + w > vw - 12) left = anchorRect.left - w - 10
        if (left < 12) left = Math.max(12, Math.min(anchorRect.left, vw - w - 12))
        let top = anchorRect.top
        if (top + hgt > vh - 12) top = Math.max(12, vh - hgt - 12)
        setPos({ left, top })
      }, [anchorRect, prompt])

      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') onRequestClose() }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [onRequestClose])

      const bits = []
      if ((prompt.useCount ?? 0) > 0) {
        bits.push(t('action.uses', { count: prompt.useCount ?? 0 }))
        const rel = relativeTime(prompt.lastUsedAt, t)
        if (rel) bits.push(t('preview.lastUsed', { time: rel }))
      } else {
        bits.push(t('action.neverUsed'))
      }
      if (prompt.createdAt) bits.push(t('preview.created', { date: formatDate(prompt.createdAt) }))
      bits.push(t('preview.chars', { n: (prompt.text ?? '').length }))

      return createPortal(
        h('div', {
          ref, className: 'pl-preview',
          style: pos === null ? { visibility: 'hidden', left: 0, top: 0 } : { left: pos.left, top: pos.top },
          'data-prompt-library': 'preview',
          onMouseEnter, onMouseLeave,
        },
          h('div', { className: 'pl-preview-title' }, prompt.title),
          (prompt.tags ?? []).length > 0
            ? h('div', { className: 'pl-row-tags' },
                prompt.tags.map((tag) => h('span', { key: tag, className: 'pl-tag' }, tag)))
            : null,
          h('div', { className: 'pl-preview-text' }, prompt.text),
          h('div', { className: 'pl-preview-meta' }, bits.join(' · '))),
        document.body)
    }

    // ---------- panel ----------

    function PromptEditor({ t, prompt, initialText, onCancel, onSubmit, saving }) {
      const [title, setTitle] = React.useState(prompt?.title ?? '')
      const [text, setText] = React.useState(prompt?.text ?? initialText ?? '')
      const [tags, setTags] = React.useState((prompt?.tags ?? []).join(', '))
      const [problem, setProblem] = React.useState(null)

      const save = () => {
        if (!title.trim()) { setProblem(t('editor.nameRequired')); return }
        if (!text.trim()) { setProblem(t('editor.textRequired')); return }
        setProblem(null)
        onSubmit({
          id: prompt?.id,
          title,
          text,
          tags: tags.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean).slice(0, 20),
        })
      }

      // Escape cancels; Ctrl/⌘+Enter saves. Both stop propagation so the
      // panel-level dismiss hook (which skips while the editor is open)
      // never races the editor's own handlers.
      const onKeyDown = (event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onCancel() }
        else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          if (!saving) save()
        }
      }

      return h('div', { className: 'pl-editor', 'data-prompt-library': 'editor', onKeyDown },
        h('div', { className: 'pl-field' },
          h('label', { className: 'pl-label' }, t('editor.name')),
          h('input', {
            className: 'pl-input', value: title, placeholder: t('editor.namePlaceholder'),
            onChange: (e) => setTitle(e.target.value), autoFocus: true,
          })),
        h('div', { className: 'pl-field' },
          h('label', { className: 'pl-label' }, t('editor.text')),
          h('textarea', {
            className: 'pl-area', value: text, placeholder: t('editor.textPlaceholder'),
            onChange: (e) => setText(e.target.value), rows: 6,
          })),
        h('div', { className: 'pl-field' },
          h('label', { className: 'pl-label' }, t('editor.tags')),
          h('input', {
            className: 'pl-input', value: tags, placeholder: t('editor.tagsPlaceholder'),
            onChange: (e) => setTags(e.target.value),
          })),
        problem ? h('div', { className: 'pl-problem' }, problem) : null,
        h('div', { className: 'pl-editor-actions' },
          h('span', { className: 'pl-editor-hint' }, t('editor.hint')),
          h('button', { type: 'button', className: 'pl-act', onClick: onCancel }, t('editor.cancel')),
          h('button', { type: 'button', className: 'pl-act pl-fill', onClick: save, disabled: saving },
            saving ? t('editor.saving') : t('editor.save'))))
    }

    function LibraryPanel({ t, canFill, onFill, onClose, seed = null }) {
      const [prompts, setPrompts] = React.useState(undefined) // undefined = loading
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null) // { text, ms }
      const [query, setQuery] = React.useState('')
      const [activeTag, setActiveTag] = React.useState(null)
      const [sort, setSort] = React.useState(() => {
        try {
          const saved = localStorage.getItem('prompt-library:sort')
          return saved === 'recent' || saved === 'created' ? saved : 'use'
        } catch { return 'use' }
      })
      const [editor, setEditor] = React.useState(null) // null | { prompt?: Prompt, initialText?: string }
      const [confirmId, setConfirmId] = React.useState(null)
      const [copiedId, setCopiedId] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [preview, setPreview] = React.useState(null) // { prompt, rect }
      const [manageTags, setManageTags] = React.useState(false)
      const fileRef = React.useRef(null)
      const hoverTimer = React.useRef(null)
      const clearHoverTimer = () => {
        if (hoverTimer.current !== null) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
      }
      React.useEffect(() => () => { if (hoverTimer.current !== null) clearTimeout(hoverTimer.current) }, [])

      // Any pointer press inside the panel (fill/copy/edit/delete) dismisses the hover preview.
      React.useEffect(() => {
        const onPointerDown = (event) => {
          const target = event.target
          if (target && typeof target.closest === 'function' &&
              target.closest('[data-prompt-library="panel"]')) setPreview(null)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => document.removeEventListener('pointerdown', onPointerDown, true)
      }, [])

      // Changing the filter can unmount the hovered row without a mouseleave.
      React.useEffect(() => { setPreview(null) }, [query, activeTag])

      // A seed (draft capture from the composer) opens the editor prefilled.
      React.useEffect(() => { if (seed != null) setEditor({ initialText: seed.text }) }, [seed])

      const onRowEnter = (prompt, element) => {
        clearHoverTimer()
        const delay = preview === null ? 300 : 120
        hoverTimer.current = setTimeout(() => {
          hoverTimer.current = null
          if (!element.isConnected) return
          setPreview({ prompt, rect: element.getBoundingClientRect() })
        }, delay)
      }
      const onRowLeave = () => {
        clearHoverTimer()
        hoverTimer.current = setTimeout(() => setPreview(null), 180)
      }
      const onPreviewEnter = () => clearHoverTimer()
      const onPreviewLeave = () => {
        clearHoverTimer()
        hoverTimer.current = setTimeout(() => setPreview(null), 120)
      }
      const closePreview = React.useCallback(() => setPreview(null), [])

      const reload = React.useCallback(async () => {
        try {
          const data = await fetchLibrary()
          const next = data.prompts ?? []
          setPrompts(next)
          setError(null)
          // Keep an open hover preview in sync (counts / last-used freshness).
          setPreview((current) => current === null ? current : {
            ...current, prompt: next.find((p) => p.id === current.prompt.id) ?? current.prompt,
          })
        } catch (err) {
          setError(err?.message || 'error')
        }
      }, [])
      React.useEffect(() => { void reload() }, [reload])

      React.useEffect(() => {
        if (copiedId === null) return undefined
        const timer = setTimeout(() => setCopiedId(null), 1500)
        return () => clearTimeout(timer)
      }, [copiedId])
      React.useEffect(() => {
        if (notice === null) return undefined
        const timer = setTimeout(() => setNotice(null), notice.ms ?? 2500)
        return () => clearTimeout(timer)
      }, [notice])

      const allTags = React.useMemo(() => {
        const counts = new Map()
        for (const prompt of prompts ?? []) {
          for (const tag of prompt.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      }, [prompts])

      // Tag operations can rename or disband the active filter tag.
      React.useEffect(() => {
        if (activeTag !== null && !allTags.some(([tag]) => tag === activeTag)) setActiveTag(null)
      }, [allTags, activeTag])

      const visible = React.useMemo(() => {
        const list = [...(prompts ?? [])]
        const filtered = activeTag === null
          ? list
          : list.filter((p) => (p.tags ?? []).includes(activeTag))
        const needle = query.trim().toLowerCase()
        const searched = needle === ''
          ? filtered
          : filtered.filter((p) =>
              p.title.toLowerCase().includes(needle) ||
              p.text.toLowerCase().includes(needle) ||
              (p.tags ?? []).some((tag) => tag.toLowerCase().includes(needle)))
        const comparators = {
          use: (a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0),
          recent: (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || (b.useCount ?? 0) - (a.useCount ?? 0),
          created: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
        }
        return searched.sort(comparators[sort] ?? comparators.use)
      }, [prompts, activeTag, query, sort])

      const totalUses = React.useMemo(
        () => (prompts ?? []).reduce((sum, p) => sum + (p.useCount ?? 0), 0),
        [prompts])

      const copyText = React.useCallback(async (prompt) => {
        try { await navigator.clipboard.writeText(prompt.text) } catch { /* clipboard may be unavailable */ }
        setCopiedId(prompt.id)
        try { await markUsed(prompt.id) } catch { /* non-fatal */ }
        void reload()
      }, [reload])

      const apply = (prompt) => {
        if (canFill) {
          const ok = onFill(prompt)
          if (!ok) setNotice({ text: t('fill.failed'), ms: 3000 })
        } else {
          void copyText(prompt)
          setNotice({ text: t('fill.noTarget'), ms: 3000 })
        }
      }

      const remove = async (id) => {
        try { await deletePrompt(id) } catch (err) { setError(err?.message || 'error'); return }
        setConfirmId(null)
        if (editor?.prompt?.id === id) setEditor(null)
        void reload()
      }

      const submit = async (payload) => {
        setSaving(true)
        try {
          await savePrompt(payload)
          setEditor(null)
          void reload()
        } catch (err) {
          setError(err?.message || 'error')
        } finally {
          setSaving(false)
        }
      }

      const renameTag = async (from, to) => {
        try { await renameTagCall(from, to) } catch (err) { setError(err?.message || 'error'); return }
        void reload()
      }

      const removeTag = async (tag) => {
        try { await deleteTagCall(tag) } catch (err) { setError(err?.message || 'error'); return }
        void reload()
      }

      const onImportFile = async (event) => {
        const file = event.target.files?.[0]
        event.target.value = '' // allow re-picking the same file
        if (!file) return
        let records = null
        try {
          const data = JSON.parse(await file.text())
          if (data !== null && typeof data === 'object' && Array.isArray(data.prompts)) records = data.prompts
        } catch { records = null }
        if (records === null) { setNotice({ text: t('import.badFile'), ms: 4000 }); return }
        try {
          const result = await importPrompts(records)
          setNotice({ text: t('import.done', { added: result.added ?? 0, updated: result.updated ?? 0 }), ms: 4000 })
          void reload()
        } catch (err) {
          setError(err?.message || 'error')
        }
      }

      const exportJson = () => {
        if (!Array.isArray(prompts) || prompts.length === 0) return
        const payload = { plugin: 'prompt-library', version: 1, exportedAt: new Date().toISOString(), prompts }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `prompt-library-${formatDate(Date.now())}.json`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
      }

      const sortOptions = [['use', 'panel.sort.use'], ['recent', 'panel.sort.recent'], ['created', 'panel.sort.created']]

      return h(React.Fragment, null,
        h('div', { className: 'pl-header' },
          h('span', { className: 'pl-title' }, t('panel.title')),
          editor === null
            ? h('button', {
                type: 'button', className: 'pl-headbtn pl-primary',
                onClick: () => { setManageTags(false); setEditor({}) },
              }, '+ ', t('panel.new'))
            : null,
          h('button', {
            type: 'button', className: 'pl-headbtn', onClick: onClose, 'aria-label': t('panel.close'),
          }, '✕')),
        editor !== null
          ? h(PromptEditor, {
              t, prompt: editor.prompt, initialText: editor.initialText, saving,
              onCancel: () => setEditor(null), onSubmit: submit,
            })
          : h(React.Fragment, null,
              manageTags ? null : h('div', { className: 'pl-toolbar' },
                h('input', {
                  className: 'pl-search', value: query, placeholder: t('panel.search'),
                  onChange: (e) => setQuery(e.target.value),
                }),
                h('select', {
                  className: 'pl-sort', value: sort,
                  onChange: (e) => {
                    setSort(e.target.value)
                    try { localStorage.setItem('prompt-library:sort', e.target.value) } catch { /* storage unavailable */ }
                  },
                  'aria-label': 'sort',
                }, sortOptions.map(([value, key]) =>
                  h('option', { key: value, value }, t(key))))),
              manageTags ? null
                : (allTags.length > 0
                    ? h(TagFilterRow, { t, tags: allTags, activeTag, onSelect: setActiveTag })
                    : null),
              h('div', { className: 'pl-body' },
                manageTags
                  ? h(React.Fragment, null,
                      h('div', { className: 'pl-mgr-head' },
                        h('button', {
                          type: 'button', className: 'pl-headbtn',
                          onClick: () => setManageTags(false),
                        }, '← ', t('tags.back'))),
                      h(TagManager, { t, tags: allTags, onRename: renameTag, onRemove: removeTag }))
                  : error !== null
                    ? h('button', { type: 'button', className: 'pl-error', onClick: () => { setError(null); void reload() } },
                        t('error.retry', { message: error }))
                    : prompts === undefined
                      ? h('div', { className: 'pl-hint' }, t('panel.loading'))
                      : visible.length === 0
                        ? h('div', { className: 'pl-empty' },
                            h('b', null, prompts.length === 0 ? t('panel.empty') : t('panel.emptyFiltered')),
                            prompts.length === 0 ? h('span', null, t('panel.emptyHint')) : null)
                        : visible.map((prompt) =>
                            h('div', {
                              key: prompt.id, className: 'pl-row',
                              onMouseEnter: (event) => onRowEnter(prompt, event.currentTarget),
                              onMouseLeave: onRowLeave,
                            },
                              h('div', { className: 'pl-row-head' },
                                h('span', { className: 'pl-row-title' }, prompt.title),
                                h('span', { className: 'pl-row-meta' },
                                  (prompt.useCount ?? 0) > 0
                                    ? `${t('action.uses', { count: prompt.useCount ?? 0 })} · ${relativeTime(prompt.lastUsedAt, t) ?? ''}`
                                    : t('action.neverUsed'))),
                              (prompt.tags ?? []).length > 0
                                ? h('div', { className: 'pl-row-tags' },
                                    prompt.tags.map((tag) => h('span', { key: tag, className: 'pl-tag' }, tag)))
                                : null,
                              h('div', { className: 'pl-row-text' }, prompt.text),
                              h('div', { className: 'pl-row-actions' },
                                h('button', {
                                  type: 'button', className: 'pl-act pl-fill', onClick: () => apply(prompt),
                                }, canFill ? t('action.fill') : t('action.copy')),
                                canFill
                                  ? h('button', {
                                      type: 'button', className: 'pl-act', onClick: () => void copyText(prompt),
                                    }, copiedId === prompt.id ? t('action.copied') : t('action.copy'))
                                  : null,
                                h('button', {
                                  type: 'button', className: 'pl-act', onClick: () => setEditor({ prompt }),
                                }, t('action.edit')),
                                h('button', {
                                  type: 'button',
                                  className: confirmId === prompt.id ? 'pl-act pl-danger' : 'pl-act',
                                  onClick: () => {
                                    if (confirmId === prompt.id) void remove(prompt.id)
                                    else setConfirmId(prompt.id)
                                  },
                                  onBlur: () => { if (confirmId === prompt.id) setConfirmId(null) },
                                }, confirmId === prompt.id ? t('action.deleteConfirm') : t('action.delete')))))),
              h('div', { className: 'pl-footer' },
                notice !== null
                  ? h('span', { className: 'pl-footstats pl-notice' }, notice.text)
                  : h('span', { className: 'pl-footstats' }, t('panel.stats', { count: prompts?.length ?? 0, uses: totalUses })),
                h('button', {
                  type: 'button', className: manageTags ? 'pl-footbtn pl-on' : 'pl-footbtn',
                  onClick: () => setManageTags((v) => !v), 'aria-pressed': String(manageTags),
                }, t('action.manageTags')),
                h('button', {
                  type: 'button', className: 'pl-footbtn', onClick: () => fileRef.current?.click(),
                }, t('action.import')),
                h('button', {
                  type: 'button', className: 'pl-footbtn', onClick: exportJson,
                }, t('action.export')),
                h('input', {
                  ref: fileRef, type: 'file', accept: '.json,application/json',
                  style: { display: 'none' }, tabIndex: -1, 'aria-hidden': 'true',
                  onChange: (e) => void onImportFile(e),
                })),
              preview !== null
                ? h(PromptPreview, {
                    t, prompt: preview.prompt, anchorRect: preview.rect,
                    onMouseEnter: onPreviewEnter, onMouseLeave: onPreviewLeave,
                    onRequestClose: closePreview,
                  })
                : null))
    }

    // ---------- tag manager ----------

    /**
     * Inline tag management: rename (merging into an existing tag when the
     * new name already exists) or strip a tag from every record. Both are
     * two-step actions, like the prompt delete button.
     */
    function TagManager({ t, tags, onRename, onRemove }) {
      const [renaming, setRenaming] = React.useState(null) // tag currently being renamed
      const [value, setValue] = React.useState('')
      const [confirming, setConfirming] = React.useState(null) // tag pending removal
      const [busy, setBusy] = React.useState(false)

      const applyRename = async () => {
        const from = renaming
        const to = value.trim()
        setRenaming(null)
        if (!from || !to || to === from) return
        setBusy(true)
        try { await onRename(from, to) } finally { setBusy(false) }
      }

      if (tags.length === 0) {
        return h('div', { className: 'pl-empty' }, h('b', null, t('tags.empty')))
      }
      return h(React.Fragment, null,
        tags.map(([tag, count]) =>
          h('div', {
            key: tag, className: 'pl-mgr-row',
            'data-prompt-library': renaming === tag ? 'editing' : undefined,
          },
            renaming === tag
              ? h(React.Fragment, null,
                  h('input', {
                    className: 'pl-mgr-input', value, autoFocus: true,
                    onChange: (e) => setValue(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void applyRename() }
                      if (e.key === 'Escape') { e.stopPropagation(); setRenaming(null) }
                    },
                  }),
                  h('button', {
                    type: 'button', className: 'pl-act pl-fill', disabled: busy,
                    onClick: () => void applyRename(),
                  }, t('editor.save')),
                  h('button', {
                    type: 'button', className: 'pl-act', disabled: busy,
                    onClick: () => setRenaming(null),
                  }, t('editor.cancel')))
              : h(React.Fragment, null,
                  h('span', { className: 'pl-mgr-name' }, tag),
                  h('span', { className: 'pl-mgr-count' }, t('tags.count', { n: count })),
                  confirming === tag
                    ? h(React.Fragment, null,
                        h('button', {
                          type: 'button', className: 'pl-act pl-danger', disabled: busy,
                          onClick: async () => {
                            setBusy(true)
                            try { await onRemove(tag) } finally { setBusy(false) }
                            setConfirming(null)
                          },
                          onBlur: () => setConfirming((current) => current === tag ? null : current),
                        }, t('tags.confirmRemove')),
                        h('button', {
                          type: 'button', className: 'pl-act', onClick: () => setConfirming(null),
                        }, t('editor.cancel')))
                    : h(React.Fragment, null,
                        h('button', {
                          type: 'button', className: 'pl-act',
                          onClick: () => { setRenaming(tag); setValue(tag) },
                        }, t('tags.rename')),
                        h('button', {
                          type: 'button', className: 'pl-act',
                          onClick: () => setConfirming(tag),
                        }, t('tags.remove')))))))
    }

    // ---------- composer draft capture ----------

    function BookmarkPlusIcon({ size }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinejoin: 'round', strokeLinecap: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M6.5 4.75h11a.75.75 0 0 1 .75.75v14.1L12 16.6l-6.25 3V5.5a.75.75 0 0 1 .75-.75Z' }),
        h('path', { d: 'M12 7.6v4.2M9.9 9.7h4.2' }))
    }

    /**
     * Composer tool-row companion: subscribe to the live draft through the
     * session's standard useInput channel and offer one-click capture. The
     * subscription lives in this leaf, so draft keystrokes never re-render
     * the panel or the toolbar button itself.
     */
    function SaveDraftButton({ useInput, t, onSave }) {
      const draft = useInput((s) => s.draft)
      const text = typeof draft === 'string' ? draft : ''
      const ready = text.trim() !== ''
      return h('button', {
        type: 'button', className: 'pl-tool', disabled: !ready,
        title: ready ? t('action.saveDraftTitle') : t('action.saveDraft'),
        'aria-label': t('action.saveDraft'),
        'data-prompt-library': 'trigger',
        onClick: () => { if (ready) onSave(text) },
      }, h(BookmarkPlusIcon, { size: 15 }))
    }

    /**
     * Insert text at the composer caret without clobbering the draft:
     * capture the insertion span, splice, and retry once when the revision
     * moved. An unfocused editor lands the text at the document end
     * (append semantics); a focused one inserts at the caret.
     */
    function insertIntoComposer(actions, text) {
      try {
        let span = actions.captureInsertion()
        if (actions.insertText(text, span)) return true
        span = actions.captureInsertion()
        return actions.insertText(text, span)
      } catch {
        return false // the composer may be unmounting
      }
    }

    // ---------- trigger entries ----------

    function ComposerToolbarButton(props) {
      const { sessionId, inputActions, useInput, t } = props

      React.useEffect(() => {
        inputActionsBySession.set(sessionId, inputActions)
        return () => {
          if (inputActionsBySession.get(sessionId) === inputActions) {
            inputActionsBySession.delete(sessionId)
          }
        }
      }, [sessionId, inputActions])

      const [open, setOpen] = React.useState(false)
      const [seed, setSeed] = React.useState(null) // { text } — captured composer draft
      const buttonRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const anchor = useAnchorAbove(buttonRef, open)
      const close = React.useCallback(() => { setOpen(false); setSeed(null) }, [])
      useDismissOnOutside(open, close)

      const fill = React.useCallback((prompt) => {
        const ok = insertIntoComposer(inputActions, prompt.text)
        if (!ok) return false
        void markUsed(prompt.id).catch(() => {})
        close() // also clears a pending draft seed, so reopening stays clean
        return true
      }, [inputActions, close])

      const saveDraft = React.useCallback((text) => {
        setSeed({ text })
        setOpen(true)
      }, [])

      return h(React.Fragment, null,
        h(PlStyle),
        h('span', { className: 'pl-tools' },
          h('button', {
            ref: buttonRef, type: 'button', className: 'pl-tool', title: t('footer.title'),
            'aria-expanded': String(open), 'aria-label': t('footer.title'),
            'data-prompt-library': 'trigger',
            onClick: () => setOpen((v) => !v),
          }, h(BookmarkIcon, { size: 15 })),
          useInput ? h(SaveDraftButton, { useInput, t, onSave: saveDraft }) : null),
        open && anchor
          ? createPortal(
              h('section', {
                ref: panelRef, className: 'pl-panel',
                style: { left: anchor.left, bottom: anchor.bottom },
                'data-prompt-library': 'panel',
              }, h(LibraryPanel, { t, canFill: true, onFill: fill, onClose: close, seed })),
              document.body)
          : null)
    }

    function FooterAction(props) {
      const { wide, useSessions, t } = props

      const [open, setOpen] = React.useState(false)
      const buttonRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const anchor = useAnchorAbove(buttonRef, open)
      const close = React.useCallback(() => setOpen(false), [])
      useDismissOnOutside(open, close)

      // The main-view session is the one the sidebar acts on (same rule as
      // the host's own Cordis panel).
      const currentSession = useSessions((state) =>
        Object.values(state.byId).find((s) => (s.retainedBy.mainView ?? 0) > 0)?.id)
      const inputActions = currentSession === undefined
        ? undefined
        : inputActionsBySession.get(currentSession)
      const canFill = inputActions !== undefined

      const fill = React.useCallback((prompt) => {
        const actions = inputActionsBySession.get(currentSession)
        if (actions === undefined) return false
        const ok = insertIntoComposer(actions, prompt.text)
        if (!ok) return false
        void markUsed(prompt.id).catch(() => {})
        setOpen(false)
        return true
      }, [currentSession])

      return h('div', { className: wide ? 'pl-layer' : 'pl-layer pl-layer-rail' },
        h(PlStyle),
        h('button', {
          ref: buttonRef, type: 'button', className: 'pl-badge', title: t('footer.title'),
          'aria-expanded': String(open), 'aria-label': t('footer.title'),
          'data-prompt-library': 'trigger',
          onClick: () => setOpen((v) => !v),
        },
          h(BookmarkIcon, { size: wide ? 16 : 18 }),
          wide ? h('span', { className: 'pl-badge-label' }, t('footer.label')) : null),
        open && anchor
          ? h('section', {
              ref: panelRef, className: 'pl-panel',
              style: { left: anchor.left, bottom: anchor.bottom },
              'data-prompt-library': 'panel',
            }, h(LibraryPanel, { t, canFill, onFill: fill, onClose: close }))
          : null)
    }

    // ---------- registration ----------

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), 'prompt-library: dictionaries')

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
          { name: 'sidebar.footer.action', id: 'prompt-library', order: 100, locale: NS },
          FooterAction,
        ))

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
          { name: 'conversation.input.left', id: 'prompt-library', order: 200, locale: NS },
          ComposerToolbarButton,
        ))
      },
    }
  },
})
