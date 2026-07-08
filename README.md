# remotelyhuman-site

The public site at [remotelyhuman.com](https://remotelyhuman.com). Astro,
static output, served by nginx, deployed via Coolify on push to `main`.

## Structure

- `src/pages/index.astro` — the landing page (keep it quiet)
- `src/pages/privacy.astro` / `terms.astro` — legal pages. **Do not move or
  rename these URLs**: they back Google OAuth app verification. Old Carrd hash
  URLs (`/#privacy-policy-section` etc.) redirect here via a shim on the
  homepage.
- `src/content/notes/*.md` — the notes garden. Drop a markdown file with
  `title`, `date`, and optional `description` frontmatter; wiki-links
  (`[[note-slug]]` or `[[note-slug|label]]`) resolve to `/notes/<slug>`.

## Publishing a note

```bash
# add src/content/notes/my-note.md, then:
git add . && git commit -m "note: my note" && git push
```

Coolify rebuilds and redeploys automatically.

## Local dev

```bash
npm install
npm run dev
```
