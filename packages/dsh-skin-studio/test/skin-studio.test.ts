import { describe, expect, it } from 'vitest'
import { contrast, hexToRgb, oklabToRgb, rgbToHex, rgbToOklab } from '../src/colors.js'
import { deriveTokens, preserveLocked } from '../src/derive.js'
import { parseSkin, parseSkinText } from '../src/schema.js'

describe('Skin Studio data and colour behavior', () => {
  it('round trips primary RGB colours through OKLab', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#123456']) expect(rgbToHex(oklabToRgb(rgbToOklab(hexToRgb(hex))))).toBe(hex)
  })

  it('derives WCAG AA primary text contrast', () => {
    const tokens = deriveTokens('#7c3aed')
    expect(contrast(tokens['--dsw-alias-label-primary'].light, tokens['--dsw-alias-bg-base'].light)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens['--dsw-alias-label-primary'].dark, tokens['--dsw-alias-bg-base'].dark)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens['--dsw-alias-label-primary-foreground'].light, tokens['--dsw-alias-brand-primary'].light)).toBeGreaterThanOrEqual(4.5)
  })

  it('preserves locked semantic tokens during automatic derivation', () => {
    const current=deriveTokens('#1677ff'), next=deriveTokens('#d95127')
    const merged=preserveLocked(current,next,['--dsw-alias-bg-base'])
    expect(merged['--dsw-alias-bg-base']).toEqual(current['--dsw-alias-bg-base'])
    expect(merged['--dsw-alias-brand-primary']).toEqual(next['--dsw-alias-brand-primary'])
  })

  it('rejects unknown and prototype-polluting dshskin data', () => {
    const base = { format: 'dshskin/v1', id: 'safe', name: 'Safe', description: '', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', tokens: deriveTokens('#1677ff'), locks: [], source: 'manual' }
    expect(parseSkin(base).id).toBe('safe')
    expect(() => parseSkin({ ...base, extra: true })).toThrow()
    expect(() => parseSkinText('{"__proto__":{"polluted":true}}')).toThrow()
  })
})
