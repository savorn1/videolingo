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
