# Archived: personal blog

This folder holds the source of the original personal blog (posts, pages,
layouts, components and styles) that used to live at the root of
patrickellis.dev. It sits outside `src/`, so Astro doesn't build it.

The full working state is also kept as the git tag `blog-archive`.

## Restoring the blog

Either check out the tag:

```bash
git checkout blog-archive
```

or move the TFT Personal Tutor files out of `src/` first, then move these back:

```bash
git mv archive/blog/src/* src/
```

The original layout also expects `public/fonts/` (still in the repo) and
`public/resume-research.pdf`. Tailwind is configured in `astro.config.mjs`.
