# Instructions for agents building this site

## The on-page widget (page-agent)

Same install pattern as `paymentverse-site` — read that repo's `AGENTS.md` for
the full architecture, DOM-friendliness rules, and the vendor-bundle warning.
The short version:

- **Widget**: [alibaba/page-agent](https://github.com/alibaba/page-agent),
  self-hosted npm library build. Config: `src/components/PageAgentWidget.astro`,
  included site-wide by `src/layouts/Base.astro`. Loads lazily on idle.
  **Never** use the vendor's jsDelivr `page-agent.demo.js` one-liner.
- **Backend**: same-origin nginx proxy (`nginx.conf`,
  `location = /api/llm/chat/completions`) → org LiteLLM gateway over the
  NetBird mesh. The proxy is the only path browsers have to the gateway.
- **Auth**: LiteLLM virtual key `remotelyhuman-widget`, embedded in the client
  bundle **by design** (treat as public). Protection is scope, not secrecy:
  it can only call the model alias `rh-widget`, rate-limited and budget-capped.
  Which real model `rh-widget` resolves to is set on the gateway (per-key
  alias), not in this repo. Rotate/revoke/repoint on ai-server via the
  gateway-onboard pattern.
- **Styling**: the panel is repositioned bottom-right and re-branded purple via
  `#page-agent-panel` overrides in the widget component (`!important` beats the
  library's inline `show()`/`hide()` styles; the `[class*=…]` selectors are
  best-effort cosmetics).
- **Contact form is native** (`/contact`, `<form id="contact-form">` posting to
  the OpnForm API, open CORS) — replaced the cross-origin iframe 2026-07-15;
  same doctrine as paymentverse-site AGENTS.md rule #3: agents can't see into
  (or even verify) cross-origin iframes, so any flow that matters gets built
  native or same-origin, with success/error as visible DOM text.

## Widget UX + telemetry (mirrored from paymentverse-site 0a903d8/866606d)

- Every finished task fires a beacon to `/api/agent-log` (nginx `return 204`;
  the query string — outcome, steps, path, truncated task text — lands in the
  container's access log). Read what visitors actually ask before deciding
  what to build: `ssh marketing-server`, then grep the site container's
  `docker logs` for `agent-log`.
- The opener card + suggestion chips (`#rh-agent-opener`) and the input
  placeholder are our DOM grafted onto the vendor panel in
  `PageAgentWidget.astro` — defensive by design; if a library update breaks
  a selector, the stock panel still works. Re-check after `page-agent` bumps.
  Unlike PV the opener is theme-aware (site tokens), and the chips are
  page-agnostic because the widget mounts on every page.
- **page-agent has NO cross-task memory** — `execute()` resets `history = []`
  every task (PageAgentCore). Session continuity is OURS: `SESSION_LOG` in
  `PageAgentWidget.astro` (fed by `onAfterTask`, injected each step via the
  `getPageInstructions` callback as a "Session so far" list). Without it the
  agent re-offers actions it just completed. On this multi-page site the log
  also dies on navigation (full page load) — a sessionStorage upgrade is the
  obvious next step if that starts to hurt. Don't remove the log; if tasks
  need more context, grow the log entries, not the system prompt.

## When you add or change a page

- Update `public/llms.txt` (the widget fetches it for site context; keep it
  under ~1000 chars — the library truncates there).
- Add a route entry to `PAGE_INSTRUCTIONS` in
  `src/components/PageAgentWidget.astro`.
- If the page renders user-specific data, add masking rules to `MASKING_RULES`
  so PII never reaches the LLM.
- Keep pages DOM-friendly (semantic elements, text in the DOM, labels that say
  what they do) — the widget reads a simplified text DOM, not pixels.
- Smoke-test: `npm run build && npm run preview`, then in a browser console
  `await window.pageAgent.execute('…a task exercising the new page…')`.
  Verify the only LLM traffic is `POST /api/llm/…`.

## Deploy

`./scripts/publish.sh` (git push + Coolify deploy trigger over the mesh).
The legal pages (`/privacy`, `/terms`) back Google OAuth verification URLs —
they must stay resolvable forever.
