# dsh-skin-studio

English | [中文](README.zh-CN.md)

A local-first DSH Skin Studio for creating, auditing, previewing, persisting, importing, and exporting semantic `--dsw-alias-*` light/dark themes.

## Screenshot

![Skin Studio token editor and preview](https://raw.githubusercontent.com/LeemanCheung/dsh-skin-studio/main/assets/screenshots/overview.png)

> Generated with GPT Image from the implemented Client layout and feature set; runtime appearance follows the active DSH theme and viewport.

## Features

- Settings → **Skin Studio** responsive library, semantic-token editor, and dual light/dark preview with six presets, locks, undo/redo, delete confirmation, and manual colour controls.
- PNG/JPEG/WebP palette sampling bounded to 10 MB and 40 megapixels, with 128px downsampling and up to six selectable OKLab k-means swatches; automatic derivation always preserves locked tokens.
- WCAG AA audit for body, secondary, and brand-button pairs, with correction of unlocked derived tokens.
- Durable Host CRUD and active-skin state through `storageDomain` and generated Typert Remotes; Save & Apply persists the current draft before replacing the reversible override.
- Strict `.dshskin` JSON export/import, Stop Preview, generated Client entry source with a declared theme dependency, and a local PNG share card.

## Data and security

`dshskin/v1` accepts at most 100 KB, 128 semantic tokens, strict metadata, six-digit hex colours, unique locks that refer to existing tokens, and requires the current DSH core background, label, brand, and border tokens. Import parses plain JSON, refuses to overwrite an existing skin with the same id, and rejects unknown fields, prototype keys, deep or oversized values, invalid token names, scripts, CSS selectors, URLs, imports, expressions, and external fonts. Imported data is never executed.

Typert Remote methods are intended for clients mounted in the same trusted DSH Web composition. They are not an authorization layer for untrusted browser plugins.

## Install

```powershell
dsh plugin --profile web add github:LeemanCheung/dsh-skin-studio
```

Restart the existing DSH Web process and refresh its page.

## Model Experience

This plugin adds no model prompt, tools, messages, token usage, or KV-cache content. Palette analysis and theme previews run in the browser; validated skins persist on the Host.

## Known limitations

The generated plugin source is text for explicit user export; Skin Studio never installs or executes it. Image sampling downsizes decoded pixels to 128px and uses one decoded frame, so animation and image metadata are not preserved. Remote CRUD is shared with trusted clients in the same composition rather than scoped to one browser package identity.

## Development

From the repository root run `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`, and `corepack pnpm pack:check`.

MIT. See [LICENSE](LICENSE).
