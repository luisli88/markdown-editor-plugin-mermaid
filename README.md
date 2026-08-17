# markdown-editor-plugin-mermaid

The [MarkdownEditor](https://github.com/luisli88/MarkdownEditor) plugin that renders
` ```mermaid ` blocks as diagrams using [Mermaid](https://mermaid.js.org/). Ships with the app by
default (fetched at build time, not vendored — see `main` repo's `plugins/bootstrap.ts`), but
installs the same way any third-party plugin does: paste this repo's URL into MarkdownEditor's
plugin install dialog.

Built from [markdown-editor-plugin-template](https://github.com/luisli88/markdown-editor-plugin-template).

## Install

In MarkdownEditor, open plugin management and paste:

```text
https://github.com/luisli88/markdown-editor-plugin-mermaid
```

The app resolves the latest published release tag automatically — no branch or version to pick.

## Usage

Insert a `mermaid` code block and write a diagram definition:

````markdown
```mermaid
graph TD;
A-->B;
```
````

Diagram colors follow MarkdownEditor's active theme via `PluginThemeContext`, the second argument
the app passes to `render()` (see `PluginThemeContext` in `@markdown-editor/plugin-sdk`, and
`derivePluginThemeContext()` in the main repo's `document-core/plugin-block-view.tsx`, which
derives it from the app's active theme for every plugin block, not just Mermaid); this plugin maps
those 8 generic slots onto Mermaid's own `themeVariables` and applies them via
`mermaid.initialize()` before each render. Its own initial `mermaid.initialize()` call at module
load only sets the fallback palette used when `theme` is absent.

## Develop

```bash
npm install
npm run build   # produces a single self-contained dist/index.js (ESM), bundling `mermaid` itself
```

`dist/index.js` is what gets fetched and sandboxed by the app — commit it before tagging a
release. The plugin runs inside a CSP-sandboxed iframe with no network access, so `mermaid` is
bundled in rather than loaded from a CDN.
