import type { Context } from '@deepseek-ai/cordis'
import { openSkinStudio } from './typert.host.js'
export { SkinStudioRemote } from './typert.host.js'
export * from './schema.js'
export * from './colors.js'
export * from './derive.js'
export const name = 'dsh-skin-studio'
export const inject = ['storageDomain']
export async function apply(ctx: Context): Promise<void> { await openSkinStudio(ctx) }
