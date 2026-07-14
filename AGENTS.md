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
