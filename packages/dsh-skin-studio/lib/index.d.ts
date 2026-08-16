import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Domain } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";
import { Context } from "@deepseek-ai/cordis";
//#region src/schema.d.ts
declare const DSH_SKIN_VERSION: "dshskin/v1";
declare const TokenName: z.ZodString;
declare const TokenModes: z.ZodObject<{
  light: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
  dark: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>;
declare const CORE_TOKEN_NAMES: readonly ["--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-label-primary", "--dsw-alias-label-secondary", "--dsw-alias-label-primary-foreground", "--dsw-alias-brand-primary", "--dsw-alias-border-l2"];
declare const SkinTokens: z.ZodRecord<z.ZodString, z.ZodObject<{
  light: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
  dark: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>>;
declare const SkinSchema: z.ZodObject<{
  format: z.ZodLiteral<"dshskin/v1">;
  id: z.ZodString;
  name: z.ZodString;
  description: z.ZodDefault<z.ZodString>;
  createdAt: z.ZodString;
  updatedAt: z.ZodString;
  tokens: z.ZodRecord<z.ZodString, z.ZodObject<{
    light: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    dark: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
  }, z.core.$strict>>;
  locks: z.ZodDefault<z.ZodArray<z.ZodString>>;
  source: z.ZodDefault<z.ZodEnum<{
    preset: "preset";
    canvas: "canvas";
    import: "import";
    manual: "manual";
  }>>;
}, z.core.$strict>;
type Skin = z.infer<typeof SkinSchema>;
declare const SkinSummarySchema: z.ZodObject<{
  id: z.ZodString;
  name: z.ZodString;
  description: z.ZodString;
  updatedAt: z.ZodString;
  source: z.ZodEnum<{
    preset: "preset";
    canvas: "canvas";
    import: "import";
    manual: "manual";
  }>;
}, z.core.$strict>;
type SkinSummary = z.infer<typeof SkinSummarySchema>;
declare const ActiveStateSchema: z.ZodObject<{
  activeId: z.ZodNullable<z.ZodString>;
  revision: z.ZodNumber;
}, z.core.$strict>;
type ActiveState = z.infer<typeof ActiveStateSchema>;
/** Parse only plain JSON data; protects Remote and persisted storage boundaries. */
declare function parseSkin(input: unknown): Skin;
declare function parseSkinText(text: string): Skin;
declare function rejectUnsafe(value: unknown, depth?: number): void;
//#endregion
//#region src/typert.host.d.ts
declare const domainSpec: {
  name: string;
  version: number;
  global: {
    schema: z.ZodObject<{
      activeId: z.ZodNullable<z.ZodString>;
      revision: z.ZodNumber;
    }, z.core.$strict>;
    initial: {
      activeId: null;
      revision: number;
    };
  };
  tables: {
    skins: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<string, {
      skin: {
        format: "dshskin/v1";
        id: string;
        name: string;
        description: string;
        createdAt: string;
        updatedAt: string;
        tokens: Record<string, {
          light: string;
          dark: string;
        }>;
        locks: string[];
        source: "preset" | "canvas" | "import" | "manual";
      };
    }>;
  };
};
declare class SkinStudioRemote extends TypertRemoteService {
  private readonly domain;
  constructor(domain: Domain<typeof domainSpec>, ctx: Context);
  list(): Promise<SkinSummary[]>;
  get(id: string): Promise<Skin | null>;
  save(input: Skin): Promise<Skin>;
  remove(id: string): Promise<boolean>;
  active(): Promise<ActiveState>;
  activate(id: string | null): Promise<ActiveState>;
  import(text: string): Promise<Skin>;
  export(id: string): Promise<string>;
  pluginSource(id: string): Promise<string>;
}
//#endregion
//#region src/colors.d.ts
type RGB = {
  r: number;
  g: number;
  b: number;
};
type OKLab = {
  l: number;
  a: number;
  b: number;
};
type OKLCH = {
  l: number;
  c: number;
  h: number;
};
declare function hexToRgb(hex: string): RGB;
declare function rgbToHex(rgb: RGB): string;
declare function rgbToOklab(rgb: RGB): OKLab;
declare function oklabToRgb(ok: OKLab): RGB;
declare function oklabToOklch(ok: OKLab): OKLCH;
declare function oklchToOklab(ok: OKLCH): OKLab;
declare function relativeLuminance(hex: string): number;
declare function contrast(a: string, b: string): number;
declare function ensureContrast(foreground: string, background: string, ratio?: number): string;
declare function kMeans(colors: RGB[], count?: number, rounds?: number): RGB[];
//#endregion
//#region src/derive.d.ts
declare const TOKEN_ROLES: readonly ["--dsw-alias-bg-base", "--dsw-alias-bg-layer-1", "--dsw-alias-label-primary", "--dsw-alias-label-secondary", "--dsw-alias-label-primary-foreground", "--dsw-alias-brand-primary", "--dsw-alias-border-l2"];
declare function deriveTokens(seed: string): Skin['tokens'];
declare function preserveLocked(tokens: Skin['tokens'], derived: Skin['tokens'], locks: readonly string[]): Skin['tokens'];
declare function audit(tokens: Skin['tokens']): {
  foreground: "--dsw-alias-label-primary" | "--dsw-alias-label-secondary" | "--dsw-alias-label-primary-foreground";
  background: "--dsw-alias-bg-base" | "--dsw-alias-brand-primary";
  light: number;
  dark: number;
}[];
declare const PRESETS: readonly [{
  readonly id: "ocean";
  readonly name: "Ocean";
  readonly seed: "#1677ff";
}, {
  readonly id: "forest";
  readonly name: "Forest";
  readonly seed: "#188038";
}, {
  readonly id: "sunset";
  readonly name: "Sunset";
  readonly seed: "#d95127";
}, {
  readonly id: "violet";
  readonly name: "Violet";
  readonly seed: "#7c3aed";
}, {
  readonly id: "rose";
  readonly name: "Rose";
  readonly seed: "#d63b70";
}, {
  readonly id: "slate";
  readonly name: "Slate";
  readonly seed: "#52616b";
}];
//#endregion
//#region src/index.d.ts
declare const name = "dsh-skin-studio";
declare const inject: string[];
declare function apply(ctx: Context): Promise<void>;
//#endregion
export { ActiveState, ActiveStateSchema, CORE_TOKEN_NAMES, DSH_SKIN_VERSION, OKLCH, OKLab, PRESETS, RGB, Skin, SkinSchema, SkinStudioRemote, SkinSummary, SkinSummarySchema, SkinTokens, TOKEN_ROLES, TokenModes, TokenName, apply, audit, contrast, deriveTokens, ensureContrast, hexToRgb, inject, kMeans, name, oklabToOklch, oklabToRgb, oklchToOklab, parseSkin, parseSkinText, preserveLocked, rejectUnsafe, relativeLuminance, rgbToHex, rgbToOklab };
//# sourceMappingURL=index.d.ts.map