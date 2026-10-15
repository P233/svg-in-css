# SVG in CSS

A browser workbench that optimizes SVG icons with SVGO and generates CSS mask rules with URL-encoded SVG data. Inspired by [URL-encoder for SVG](https://yoksel.github.io/url-encoder/).

- [Live Project](https://peiwen.lu/project/svg-in-css)
- [Detailed Explanation](https://peiwen.lu/posts/svg-in-css)

## Usage

Upload `.svg` files or import an exported JSON configuration. Rename and sort icons, set the CSS class prefix and shared size, then copy or download the generated CSS. Options control SVGO optimization, `-webkit-` prefixes and `::before` output.

The code preview highlights CSS syntax in both light and dark themes. The theme follows the system by default; manual choices survive reloads until the system theme changes.

Icons and output settings are saved in the current browser. Export the JSON configuration for backup or transfer. If browser storage is unavailable or full, the app warns you and offers an export action.

## Development

Use the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Run `pnpm lint`, `pnpm format:check` and `pnpm test` before committing. The tests build the production app and cover SVG validation and encoding, import ordering, persistence, renaming and theme behavior in Chromium. IME regressions use synthetic composition-related keyboard events; they do not exercise a native OS input method.

## Website integration

The live demo loads `public/svg-in-css/index.js` from the [peiwen.lu repository](https://github.com/P233/peiwen.lu). Build this project with `pnpm build` and copy the generated `dist/assets/index-*.js` bundle to that path when updating the demo.
