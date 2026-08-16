import { z } from 'zod'

export const DSH_SKIN_VERSION = 'dshskin/v1' as const
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform(value => value.toLowerCase())
export const TokenName = z.string().regex(/^--dsw-alias-[a-z0-9-]{1,80}$/)
export const TokenModes = z.object({ light: hex, dark: hex }).strict()
export const CORE_TOKEN_NAMES = ['--dsw-alias-bg-base','--dsw-alias-bg-layer-1','--dsw-alias-label-primary','--dsw-alias-label-secondary','--dsw-alias-label-primary-foreground','--dsw-alias-brand-primary','--dsw-alias-border-l2'] as const
export const SkinTokens = z.record(TokenName, TokenModes).superRefine((tokens, ctx) => {
  if (Object.keys(tokens).length > 128) ctx.addIssue({ code: 'custom', message: 'A skin may contain at most 128 tokens.' })
  for (const token of CORE_TOKEN_NAMES) if (!(token in tokens)) ctx.addIssue({ code: 'custom', path: [token], message: `Required semantic token is missing: ${token}` })
})
export const SkinSchema = z.object({
  format: z.literal(DSH_SKIN_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(''),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  tokens: SkinTokens,
  locks: z.array(TokenName).max(128).default([]),
  source: z.enum(['preset', 'canvas', 'import', 'manual']).default('manual'),
}).strict().superRefine((skin, ctx) => {
  if (new Set(skin.locks).size !== skin.locks.length) ctx.addIssue({ code: 'custom', message: 'Locks must be unique.' })
  for (const lock of skin.locks) if (!(lock in skin.tokens)) ctx.addIssue({ code: 'custom', message: `Lock references unknown token ${lock}.` })
})
export type Skin = z.infer<typeof SkinSchema>
export const SkinSummarySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500),
  updatedAt: z.string().datetime(),
  source: z.enum(['preset', 'canvas', 'import', 'manual']),
}).strict()
export type SkinSummary = z.infer<typeof SkinSummarySchema>
export const ActiveStateSchema = z.object({ activeId: z.string().nullable(), revision: z.number().int().nonnegative() }).strict()
export type ActiveState = z.infer<typeof ActiveStateSchema>

/** Parse only plain JSON data; protects Remote and persisted storage boundaries. */
export function parseSkin(input: unknown): Skin {
  rejectUnsafe(input)
  return SkinSchema.parse(input)
}
export function parseSkinText(text: string): Skin {
  if (text.length > 100_000) throw new Error('Skin file exceeds 100 KB.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('Skin file is not valid JSON.') }
  return parseSkin(value)
}
export function rejectUnsafe(value: unknown, depth = 0): void {
  if (depth > 12) throw new Error('Skin JSON nesting is too deep.')
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return
  if (Array.isArray(value)) { if (value.length > 256) throw new Error('Skin JSON array is too large.'); value.forEach(item => rejectUnsafe(item, depth + 1)); return }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Skin data must be plain JSON.')
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('Unsafe JSON key rejected.')
    rejectUnsafe(item, depth + 1)
  }
}
