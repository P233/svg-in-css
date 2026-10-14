# SVG in CSS

Utilizing URL encoding and CSS masking to embed SVG icons within CSS. Inspired by [URL-encoder for SVG](https://yoksel.github.io/url-encoder/).

- [Live Project](https://peiwen.lu/project/svg-in-css)
- [Detailed Explanation](https://peiwen.lu/posts/svg-in-css)

## Development

Use the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

Run `pnpm lint`, `pnpm format:check`, and `pnpm test` before committing. The tests build the production app and cover persistence and rename interactions in Chromium. IME regressions use synthetic composition-related keyboard events; they do not exercise a native OS input method.
