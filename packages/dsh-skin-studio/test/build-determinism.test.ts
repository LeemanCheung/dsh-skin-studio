import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clientBundle, normalizeSourceMap } from '../../../build/plugin-bundle.ts'

type CssPlugin = {
  resolveId(source: string, importer: string): string
  load(this: { addWatchFile(filename: string): void }, id: string): Promise<string>
}

describe('portable CSS module builds', () => {
  it('preserves a source map final newline as LF without trimming embedded text', () => {
    const source = JSON.stringify({ sources: ['src\\client.ts'], sourcesContent: ['const value = `kept  \r\n  `\r\n'] })
    const expected = JSON.stringify({ sources: ['src/client.ts'], sourcesContent: ['const value = `kept  \n  `\n'] })
    expect(normalizeSourceMap(source)).toBe(expected)
    expect(normalizeSourceMap(source + '\n')).toBe(expected + '\n')
    expect(normalizeSourceMap(source + '\r\n')).toBe(expected + '\n')
  })

  it('preserves identical module IDs and output across checkout roots and line endings', async () => {
    const fixture = mkdtempSync(join(tmpdir(), 'dsh-skin-build-test-'))
    try {
      const outputs = []
      for (const [directory, newline] of [['first-checkout', '\n'], ['second-checkout', '\r\n']]) {
        const root = join(fixture, directory)
        const source = join(root, 'src', 'client')
        mkdirSync(source, { recursive: true })
        writeFileSync(join(source, 'studio.module.css'), ['.studio { color: red; }', '.label { display: grid; }', ''].join(newline))
        const config = clientBundle('dsh-skin-studio', root) as { plugins: CssPlugin[] }
        const plugin = config.plugins[0]
        const id = plugin.resolveId('./studio.module.css', join(source, 'index.tsx'))
        const watched: string[] = []
        const code = await plugin.load.call({ addWatchFile: filename => watched.push(filename) }, id)
        expect(watched).toEqual([join(source, 'studio.module.css')])
        expect(id).not.toContain(root)
        expect(code).not.toContain(root)
        outputs.push({ id, code })
      }
      expect(outputs[0]).toEqual(outputs[1])
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
})
