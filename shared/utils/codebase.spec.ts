import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Checks on the code base itself, for mistakes that are easy to make and slow to notice.

const root = resolve(__dirname, '../..')

function files(dir: string, ext: string, skip: (name: string) => boolean = () => false): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...files(full, ext, skip))
    else if (entry.name.endsWith(ext) && !skip(entry.name)) out.push(full)
  }
  return out
}

describe('auto-imported names', () => {
  // Nuxt makes every exported function/const in these folders available by name, everywhere. Two files
  // exporting the same name means one silently wins (Nuxt only prints a warning), so it's caught here.
  it('are each exported from one file only', () => {
    const owners = new Map<string, string[]>()
    const sources = [
      ...files(join(root, 'shared/utils'), '.ts', (n) => n.endsWith('.spec.ts') || n.endsWith('.d.ts')),
      ...files(join(root, 'app/composables'), '.ts', (n) => n.endsWith('.spec.ts'))
    ]
    for (const file of sources) {
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/^export (?:async )?(?:function|const|class)\s+([A-Za-z0-9_]+)/gm)) {
        owners.set(m[1]!, [...(owners.get(m[1]!) ?? []), file.replace(root + '/', '')])
      }
    }
    const clashes = [...owners].filter(([, where]) => where.length > 1).map(([name, where]) => `${name}: ${where.join(', ')}`)
    expect(clashes).toEqual([])
  })
})

describe('icon-only buttons', () => {
  // A button that shows only an icon has no name for a screen reader (or a hover) unless it is given one.
  it('have an aria-label or a title', () => {
    const offenders: string[] = []
    for (const file of files(join(root, 'app'), '.vue')) {
      const text = readFileSync(file, 'utf8')
      // A whole self-closing <UButton ... /> that has an icon, no text inside, and no name.
      for (const m of text.matchAll(/<UButton\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/>/gs)) {
        const attrs = m[1]!
        const hasIcon = /\bicon=/.test(attrs)
        const named = /aria-label=|:aria-label=|\btitle=|:title=|\blabel=|:label=/.test(attrs)
        if (hasIcon && !named) offenders.push(`${file.replace(root + '/', '')}: ${m[0].replace(/\s+/g, ' ').slice(0, 110)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('motion', () => {
  // Script scrolling with behavior 'smooth' ignores the system's Reduce Motion setting (CSS smooth scrolling doesn't);
  // scrollMotion() asks it first.
  it('scrolls smoothly only through scrollMotion()', () => {
    const offenders = [...files(join(root, 'app'), '.vue'), ...files(join(root, 'app'), '.ts')]
      .filter((file) => /behavior:\s*['"]smooth['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(root + '/', ''))
    expect(offenders).toEqual([])
  })
})

describe('text colours', () => {
  // On a white page, gray-300/400 text is about 1.5:1 and 2.5:1 — too faint to read — and error-500 red is 3.8:1.
  // Text needs 4.5:1, so it should use gray-500 (4.8:1) or darker, and error-600. (Icons are exempt, and so are
  // classes set with :class, which this doesn't read.) Keep the dark-mode shade next to it: dark:text-gray-400.
  it('are dark enough to read in light mode', () => {
    const faint = new Set(['text-gray-300', 'text-gray-400', 'text-error-500'])
    const offenders: string[] = []
    for (const [file, tag, cls] of textClasses()) {
      const bad = cls.split(/\s+/).filter((t) => faint.has(t))
      if (bad.length) offenders.push(`${file}: <${tag}> ${bad.join(' ')}`)
    }
    expect(offenders).toEqual([])
  })
  // gray-500 text on the dark page is 3:1; it needs dark:text-gray-400 beside it, or the text-muted token, which adapts.
  it('have a dark-mode shade when they are gray-500', () => {
    const offenders = textClasses()
      .filter(([, , cls]) => /(^|\s)text-gray-500(\s|$)/.test(cls) && !/\bdark:text-/.test(cls))
      .map(([file, tag]) => `${file}: <${tag}>`)
    expect(offenders).toEqual([])
  })
})

/** [file, tag, static class] for each element that shows text (icons, inputs and switches left out). The sidebar is
 *  always dark, so its light greys are right and it's left out too. */
function textClasses(): [string, string, string][] {
  const out: [string, string, string][] = []
  for (const file of files(join(root, 'app'), '.vue', (n) => n === 'SidebarNav.vue')) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/<([A-Za-z][\w.-]*)((?:[^<>"']|"[^"]*"|'[^']*')*?)>/gs)) {
      if (['UIcon', 'Icon', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'input', 'USwitch'].includes(m[1]!)) continue
      const cls = /\sclass="([^"]*)"/.exec(m[2]!)?.[1]
      if (!cls || /placeholder|disabled/.test(cls)) continue
      out.push([file.replace(root + '/', ''), m[1]!, cls])
    }
  }
  return out
}

// The theme's colour tokens (main.css) are checked in a browser, which works out color-mix() and the palettes:
// e2e/shell.spec.ts, "theme colours".
