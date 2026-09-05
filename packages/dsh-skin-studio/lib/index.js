import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { z } from "zod";
//#region src/schema.ts
const DSH_SKIN_VERSION = "dshskin/v1";
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toLowerCase());
const TokenName = z.string().regex(/^--dsw-alias-[a-z0-9-]{1,80}$/);
const TokenModes = z.object({
	light: hex,
	dark: hex
}).strict();
const CORE_TOKEN_NAMES = [
	"--dsw-alias-bg-base",
	"--dsw-alias-bg-layer-1",
	"--dsw-alias-label-primary",
	"--dsw-alias-label-secondary",
	"--dsw-alias-label-primary-foreground",
	"--dsw-alias-brand-primary",
	"--dsw-alias-border-l2"
];
const SkinTokens = z.record(TokenName, TokenModes).superRefine((tokens, ctx) => {
	if (Object.keys(tokens).length > 128) ctx.addIssue({
		code: "custom",
		message: "A skin may contain at most 128 tokens."
	});
	for (const token of CORE_TOKEN_NAMES) if (!(token in tokens)) ctx.addIssue({
		code: "custom",
		path: [token],
		message: `Required semantic token is missing: ${token}`
	});
});
const SkinSchema = z.object({
	format: z.literal(DSH_SKIN_VERSION),
	id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
	name: z.string().trim().min(1).max(80),
	description: z.string().trim().max(500).default(""),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	tokens: SkinTokens,
	locks: z.array(TokenName).max(128).default([]),
	source: z.enum([
		"preset",
		"canvas",
		"import",
		"manual"
	]).default("manual")
}).strict().superRefine((skin, ctx) => {
	if (new Set(skin.locks).size !== skin.locks.length) ctx.addIssue({
		code: "custom",
		message: "Locks must be unique."
	});
	for (const lock of skin.locks) if (!(lock in skin.tokens)) ctx.addIssue({
		code: "custom",
		message: `Lock references unknown token ${lock}.`
	});
});
const SkinSummarySchema = z.object({
	id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
	name: z.string().trim().min(1).max(80),
	description: z.string().trim().max(500),
	updatedAt: z.string().datetime(),
	source: z.enum([
		"preset",
		"canvas",
		"import",
		"manual"
	])
}).strict();
const ActiveStateSchema = z.object({
	activeId: z.string().nullable(),
	revision: z.number().int().nonnegative()
}).strict();
/** Parse only plain JSON data; protects Remote and persisted storage boundaries. */
function parseSkin(input) {
	rejectUnsafe(input);
	return SkinSchema.parse(input);
}
function parseSkinText(text) {
	if (text.length > 1e5) throw new Error("Skin file exceeds 100 KB.");
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw new Error("Skin file is not valid JSON.");
	}
	return parseSkin(value);
}
function rejectUnsafe(value, depth = 0) {
	if (depth > 12) throw new Error("Skin JSON nesting is too deep.");
	if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return;
	if (Array.isArray(value)) {
		if (value.length > 256) throw new Error("Skin JSON array is too large.");
		value.forEach((item) => rejectUnsafe(item, depth + 1));
		return;
	}
	if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("Skin data must be plain JSON.");
	for (const [key, item] of Object.entries(value)) {
		if (key === "__proto__" || key === "constructor" || key === "prototype") throw new Error("Unsafe JSON key rejected.");
		rejectUnsafe(item, depth + 1);
	}
}
//#endregion
//#region src/typert.host.ts
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
const domainSpec = defineDomain({
	name: "skin_studio",
	version: 1,
	global: {
		schema: ActiveStateSchema,
		initial: {
			activeId: null,
			revision: 0
		}
	},
	tables: { skins: domainTable(z.object({ skin: SkinSchema }).strict()) }
});
const now = () => (/* @__PURE__ */ new Date()).toISOString();
const safeId = (id) => {
	if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error("Invalid skin id.");
	return id;
};
let SkinStudioRemote = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _get_decorators;
	let _save_decorators;
	let _deleteSkin_decorators;
	let _active_decorators;
	let _activate_decorators;
	let _import_decorators;
	let _export_decorators;
	let _pluginSource_decorators;
	return class SkinStudioRemote extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote];
			_get_decorators = [Remote];
			_save_decorators = [Remote];
			_deleteSkin_decorators = [Remote];
			_active_decorators = [Remote];
			_activate_decorators = [Remote];
			_import_decorators = [Remote];
			_export_decorators = [Remote];
			_pluginSource_decorators = [Remote];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _get_decorators, {
				kind: "method",
				name: "get",
				static: false,
				private: false,
				access: {
					has: (obj) => "get" in obj,
					get: (obj) => obj.get
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _save_decorators, {
				kind: "method",
				name: "save",
				static: false,
				private: false,
				access: {
					has: (obj) => "save" in obj,
					get: (obj) => obj.save
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteSkin_decorators, {
				kind: "method",
				name: "deleteSkin",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteSkin" in obj,
					get: (obj) => obj.deleteSkin
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _active_decorators, {
				kind: "method",
				name: "active",
				static: false,
				private: false,
				access: {
					has: (obj) => "active" in obj,
					get: (obj) => obj.active
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _activate_decorators, {
				kind: "method",
				name: "activate",
				static: false,
				private: false,
				access: {
					has: (obj) => "activate" in obj,
					get: (obj) => obj.activate
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _import_decorators, {
				kind: "method",
				name: "import",
				static: false,
				private: false,
				access: {
					has: (obj) => "import" in obj,
					get: (obj) => obj.import
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _export_decorators, {
				kind: "method",
				name: "export",
				static: false,
				private: false,
				access: {
					has: (obj) => "export" in obj,
					get: (obj) => obj.export
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _pluginSource_decorators, {
				kind: "method",
				name: "pluginSource",
				static: false,
				private: false,
				access: {
					has: (obj) => "pluginSource" in obj,
					get: (obj) => obj.pluginSource
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		domain = __runInitializers(this, _instanceExtraInitializers);
		constructor(domain, ctx) {
			super(ctx, "skinStudio");
			this.domain = domain;
		}
		async list() {
			return [...this.domain.table("skins").entries()].map(([, row]) => SkinSummarySchema.parse({
				id: row.skin.id,
				name: row.skin.name,
				description: row.skin.description,
				updatedAt: row.skin.updatedAt,
				source: row.skin.source
			})).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		}
		async get(id) {
			return this.domain.table("skins").get(safeId(id))?.skin ?? null;
		}
		async save(input) {
			const parsed = parseSkin(input);
			const existing = this.domain.table("skins").get(parsed.id)?.skin;
			const skin = {
				...parsed,
				createdAt: existing?.createdAt ?? parsed.createdAt ?? now(),
				updatedAt: now()
			};
			await this.domain.table("skins").put(skin.id, { skin });
			return skin;
		}
		async deleteSkin(id) {
			const key = safeId(id);
			const active = this.domain.global.get();
			if (active.activeId === key) await this.domain.global.set({
				...active,
				activeId: null,
				revision: active.revision + 1
			});
			return this.domain.table("skins").delete(key);
		}
		async active() {
			return this.domain.global.get();
		}
		async activate(id) {
			if (id !== null && !this.domain.table("skins").get(safeId(id))) throw new Error("Skin not found.");
			const next = {
				activeId: id,
				revision: this.domain.global.get().revision + 1
			};
			await this.domain.global.set(next);
			return next;
		}
		async import(text) {
			const skin = parseSkinText(text);
			if (this.domain.table("skins").get(skin.id)) throw new Error(`Skin id already exists: ${skin.id}`);
			return this.save({
				...skin,
				source: "import"
			});
		}
		async export(id) {
			const skin = await this.get(id);
			if (!skin) throw new Error("Skin not found.");
			return JSON.stringify(skin, null, 2);
		}
		async pluginSource(id) {
			const skin = await this.get(id);
			if (!skin) throw new Error("Skin not found.");
			return `// Client entry generated by dsh-skin-studio. Bundle it as the dsh.client entry of a DSH npm package.\nexport const name = 'skin-${skin.id}'\nexport const inject = ['theme']\nexport function apply(ctx) {\n  return ctx.theme.overrideTokens('skin-${skin.id}', ${JSON.stringify(skin.tokens, null, 2)})\n}\n`;
		}
	};
})();
async function openSkinStudio(ctx) {
	const domain = await ctx.storageDomain.open(domainSpec);
	ctx.effect(() => () => domain.close());
	return new SkinStudioRemote(domain, ctx);
}
//#endregion
//#region src/colors.ts
const clamp = (n) => Math.max(0, Math.min(1, n));
const linear = (n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
const gamma = (n) => n <= .0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - .055;
function hexToRgb(hex) {
	const value = Number.parseInt(hex.slice(1), 16);
	return {
		r: value >> 16,
		g: value >> 8 & 255,
		b: value & 255
	};
}
function rgbToHex(rgb) {
	return "#" + [
		rgb.r,
		rgb.g,
		rgb.b
	].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
function rgbToOklab(rgb) {
	const r = linear(rgb.r / 255), g = linear(rgb.g / 255), b = linear(rgb.b / 255);
	const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
	return {
		l: .2104542553 * l + .793617785 * m - .0040720468 * s,
		a: 1.9779984951 * l - 2.428592205 * m + .4505937099 * s,
		b: .0259040371 * l + .7827717662 * m - .808675766 * s
	};
}
function oklabToRgb(ok) {
	const l = (ok.l + .3963377774 * ok.a + .2158037573 * ok.b) ** 3, m = (ok.l - .1055613458 * ok.a - .0638541728 * ok.b) ** 3, s = (ok.l - .0894841775 * ok.a - 1.291485548 * ok.b) ** 3;
	return {
		r: Math.round(clamp(gamma(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s)) * 255),
		g: Math.round(clamp(gamma(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * s)) * 255),
		b: Math.round(clamp(gamma(-.0041960863 * l - .7034186147 * m + 1.707614701 * s)) * 255)
	};
}
function oklabToOklch(ok) {
	const c = Math.hypot(ok.a, ok.b);
	return {
		l: ok.l,
		c,
		h: (Math.atan2(ok.b, ok.a) * 180 / Math.PI + 360) % 360
	};
}
function oklchToOklab(ok) {
	const h = ok.h * Math.PI / 180;
	return {
		l: ok.l,
		a: ok.c * Math.cos(h),
		b: ok.c * Math.sin(h)
	};
}
function relativeLuminance(hex) {
	const { r, g, b } = hexToRgb(hex);
	return .2126 * linear(r / 255) + .7152 * linear(g / 255) + .0722 * linear(b / 255);
}
function contrast(a, b) {
	const values = [relativeLuminance(a), relativeLuminance(b)].sort((m, n) => n - m);
	return (values[0] + .05) / (values[1] + .05);
}
function ensureContrast(foreground, background, ratio = 4.5) {
	const initial = rgbToHex(hexToRgb(foreground));
	if (contrast(initial, background) >= ratio) return initial;
	const black = "#000000", white = "#ffffff";
	const target = contrast(black, background) >= contrast(white, background) ? black : white;
	if (contrast(target, background) < ratio) return target;
	const start = rgbToOklab(hexToRgb(initial)), end = rgbToOklab(hexToRgb(target));
	let failing = 0, passing = 1, result = target;
	for (let i = 0; i < 24; i++) {
		const amount = (failing + passing) / 2;
		const candidate = rgbToHex(oklabToRgb({
			l: start.l + (end.l - start.l) * amount,
			a: start.a + (end.a - start.a) * amount,
			b: start.b + (end.b - start.b) * amount
		}));
		if (contrast(candidate, background) >= ratio) {
			passing = amount;
			result = candidate;
		} else failing = amount;
	}
	return result;
}
function kMeans(colors, count = 6, rounds = 12) {
	if (!colors.length) return [];
	const points = colors.map(rgbToOklab);
	const size = Math.min(count, points.length);
	const centers = Array.from({ length: size }, (_, i) => points[Math.floor(i * points.length / size)]);
	for (let n = 0; n < rounds; n++) {
		const bins = centers.map(() => []);
		for (const p of points) {
			let best = 0, d = Infinity;
			centers.forEach((c, i) => {
				const x = (p.l - c.l) ** 2 + (p.a - c.a) ** 2 + (p.b - c.b) ** 2;
				if (x < d) {
					d = x;
					best = i;
				}
			});
			bins[best].push(p);
		}
		bins.forEach((bin, i) => {
			if (bin.length) centers[i] = bin.reduce((a, p) => ({
				l: a.l + p.l / bin.length,
				a: a.a + p.a / bin.length,
				b: a.b + p.b / bin.length
			}), {
				l: 0,
				a: 0,
				b: 0
			});
		});
	}
	return centers.map(oklabToRgb);
}
//#endregion
//#region src/derive.ts
const TOKEN_ROLES = [
	"--dsw-alias-bg-base",
	"--dsw-alias-bg-layer-1",
	"--dsw-alias-label-primary",
	"--dsw-alias-label-secondary",
	"--dsw-alias-label-primary-foreground",
	"--dsw-alias-brand-primary",
	"--dsw-alias-border-l2"
];
function deriveTokens(seed) {
	const lch = oklabToOklch(rgbToOklab(hexToRgb(seed)));
	const tint = (l, c = lch.c) => rgbToHex(oklabToRgb(oklchToOklab({
		l,
		c,
		h: lch.h
	})));
	const lightBg = tint(.97, .02), darkBg = tint(.16, .025), lightText = ensureContrast(tint(.18, .03), lightBg), darkText = ensureContrast(tint(.9, .03), darkBg), accent = tint(Math.max(.45, Math.min(.68, lch.l)), Math.max(.08, lch.c));
	return {
		"--dsw-alias-bg-base": {
			light: lightBg,
			dark: darkBg
		},
		"--dsw-alias-bg-layer-1": {
			light: tint(.93, .03),
			dark: tint(.22, .03)
		},
		"--dsw-alias-label-primary": {
			light: lightText,
			dark: darkText
		},
		"--dsw-alias-label-secondary": {
			light: ensureContrast(tint(.37, .02), lightBg, 4.5),
			dark: ensureContrast(tint(.72, .02), darkBg, 4.5)
		},
		"--dsw-alias-label-primary-foreground": {
			light: ensureContrast("#ffffff", accent, 4.5),
			dark: ensureContrast("#ffffff", accent, 4.5)
		},
		"--dsw-alias-brand-primary": {
			light: accent,
			dark: accent
		},
		"--dsw-alias-border-l2": {
			light: tint(.8, .025),
			dark: tint(.34, .03)
		}
	};
}
function preserveLocked(tokens, derived, locks) {
	const next = { ...derived };
	for (const key of locks) if (tokens[key]) next[key] = tokens[key];
	return next;
}
function audit(tokens) {
	return [
		["--dsw-alias-label-primary", "--dsw-alias-bg-base"],
		["--dsw-alias-label-secondary", "--dsw-alias-bg-base"],
		["--dsw-alias-label-primary-foreground", "--dsw-alias-brand-primary"]
	].map(([foreground, background]) => ({
		foreground,
		background,
		light: tokens[foreground] && tokens[background] ? Math.round(contrast(tokens[foreground].light, tokens[background].light) * 100) / 100 : 0,
		dark: tokens[foreground] && tokens[background] ? Math.round(contrast(tokens[foreground].dark, tokens[background].dark) * 100) / 100 : 0
	}));
}
const PRESETS = [
	{
		id: "ocean",
		name: "Ocean",
		seed: "#1677ff"
	},
	{
		id: "forest",
		name: "Forest",
		seed: "#188038"
	},
	{
		id: "sunset",
		name: "Sunset",
		seed: "#d95127"
	},
	{
		id: "violet",
		name: "Violet",
		seed: "#7c3aed"
	},
	{
		id: "rose",
		name: "Rose",
		seed: "#d63b70"
	},
	{
		id: "slate",
		name: "Slate",
		seed: "#52616b"
	}
];
//#endregion
//#region src/index.ts
const name = "dsh-skin-studio";
const inject = ["storageDomain"];
async function apply(ctx) {
	await openSkinStudio(ctx);
}
//#endregion
export { ActiveStateSchema, CORE_TOKEN_NAMES, DSH_SKIN_VERSION, PRESETS, SkinSchema, SkinStudioRemote, SkinSummarySchema, SkinTokens, TOKEN_ROLES, TokenModes, TokenName, apply, audit, contrast, deriveTokens, ensureContrast, hexToRgb, inject, kMeans, name, oklabToOklch, oklabToRgb, oklchToOklab, parseSkin, parseSkinText, preserveLocked, rejectUnsafe, relativeLuminance, rgbToHex, rgbToOklab };

//# sourceMappingURL=index.js.map