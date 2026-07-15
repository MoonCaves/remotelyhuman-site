/*
  Agent ENGINE — headless. This is page-agent's core (DOM reading, LLM calls,
  task execution) with NO face attached.

  The face was ripped off deliberately (2026-07-15, mirrored from
  paymentverse-site): we build on `PageAgentCore` from `@page-agent/core` and
  never import `@page-agent/ui`, so the visual layer is a swappable adapter
  (see face.ts). Everything in here is engine-level and face-agnostic — LLM
  proxy wiring, prompts, session memory, masking, telemetry, the scroll-tool
  override, and the scroll-behaviour fix.

  Backend unchanged: same-origin nginx proxy -> LiteLLM gateway. The key is
  public-by-design, scoped to the rh-widget alias (key alias:
  remotelyhuman-widget), rate/budget-limited. Which model rh-widget resolves to
  is a gateway-side decision — see AGENTS.md. Keep this file, /public/llms.txt,
  and AGENTS.md in sync as pages grow.
*/
import { PageAgentCore, tool } from '@page-agent/core'
import { PageController } from '@page-agent/page-controller'
import { z } from 'zod/v4'

// Per-route guidance injected into the agent's prompt on every step.
// Add an entry when a new page ships (see AGENTS.md).
const PAGE_INSTRUCTIONS: Record<string, string> = {
  '/':
    'Home. Top to bottom: header (BLOG, CONTACT OPS, theme toggle), hero with cycling tagline, "Notes & ops" cards (The garden / The ops desk), "From the notes" grid, footer. Full page map is in llms.txt.',
  '/projects': 'Projects: six project cards with short descriptions.',
  '/contact':
    'Contact. The form is native (#contact-form, fields: Name, Email, Message, button "Send to Ops"). You can fill and submit it; after submitting, verify by the visible confirmation text "Message sent".',
  '/notes':
    'Notes index — the digital garden. Each entry links to a full note page.',
}

const pageInstructionFor = (pathname: string): string | undefined => {
  const path = pathname.replace(/\/$/, '') || '/'
  if (path.startsWith('/notes/'))
    return 'A single note (blog post). Related notes are wiki-linked in the body; the notes index is at /notes.'
  return PAGE_INSTRUCTIONS[path]
}

// Masking rules applied to page content before it reaches the LLM.
// The site renders no visitor PII today; add [pattern, replacement]
// pairs here the moment any page starts showing user-specific data.
const MASKING_RULES: Array<[RegExp, string]> = []

// Cross-task session memory (pattern from paymentverse-site 866606d).
// page-agent wipes its history at the start of EVERY execute()
// (PageAgentCore resets `history = []`) — each task is amnesiac, which
// makes the agent re-offer actions it just completed. We keep our own log
// and inject it per step via the instructions callback. Note: on this
// multi-page site the log also dies on navigation (full page load).
const SESSION_LOG: string[] = []

/**
 * Build the headless agent engine. Idempotent: reuses window.pageAgent if a
 * prior call already created it. The caller (a face, via face.ts) drives it:
 * `engine.execute(task)`, `engine.addEventListener('activity'|'statuschange')`,
 * and `engine.onAskUser = …`.
 */
export function createEngine(): PageAgentCore {
  const existing = (window as any).pageAgent as PageAgentCore | undefined
  if (existing) return existing

  const engine = new PageAgentCore({
    // Required DOM controller — dropped when the face was decoupled from
    // @page-agent/ui (the stock Panel used to construct it), so every task
    // crashed at getBrowserState(). Restored 2026-07-16 (mirrors the PV fix).
    pageController: new PageController(),
    model: 'rh-widget',
    baseURL: '/api/llm',
    apiKey: 'sk-PZqAgca4d9r0xCWNnd19yw',
    language: 'en-US',
    maxSteps: 15,
    instructions: {
      system: [
        'You are the on-page assistant for remotelyhuman.com, the site of Remotely Human — a small studio that works quietly across many software projects.',
        'Your goals, in order: (1) answer questions about Remotely Human briefly and accurately from page content; (2) help visitors find what they came for — notes, projects, or the contact page; (3) when a visitor wants to reach the team, fill the contact form (/contact) for them: use the ask_user tool to collect their real name, email, and message — never invent, guess, or reuse example contact details — then submit and confirm via the visible "Message sent" text.',
        'This is a multi-page site: clicking a link to another page does a full page load, which ends your current task — so before clicking through, tell the visitor what to look for there.',
        'Your instructions may include a "Session so far" list — actions you already completed for this visitor. Trust it and never redo a completed action; in particular, never offer or collect details for another contact note after one was sent, unless the visitor explicitly asks to send another.',
        'You were not pre-trained on this site: you are reading it live, the same way any visiting AI agent would. If a visitor asks how you know things, say so.',
        "Match the site's tone: calm, dry, no hype. Close completed tasks with a concrete next step when one makes sense; don't force it.",
        'Never navigate away from this site. Politely decline destructive or unrelated requests and steer back to Remotely Human.',
      ].join(' '),
      getPageInstructions: (url: string) => {
        try {
          let out = pageInstructionFor(new URL(url).pathname) || ''
          if (SESSION_LOG.length) {
            out +=
              '\nSession so far (already completed for this visitor — do NOT repeat): ' +
              SESSION_LOG.slice(-6).join(' | ')
          }
          return out || undefined
        } catch {
          return undefined
        }
      },
    },
    // Site context for the agent from /llms.txt (same-origin fetch, cached).
    experimentalLlmsTxt: true,
    transformPageContent: (content: string) => {
      for (const [pattern, replacement] of MASKING_RULES) {
        content = content.replace(pattern, replacement)
      }
      return content
    },
    // Request-body escape hatch. The current OpenAI-sub lane prompt-caches
    // automatically; if the gateway lane moves back to Claude, add top-level
    // cache_control here (per the page-agent models doc).
    transformRequestBody: (body: any) => body,
    // Task telemetry (phones home to us only): the query string lands in
    // our nginx access log via /api/agent-log — what visitors ask steers
    // the build-out. Task text is visitor input; truncated, never stored
    // beyond the container log. (Pattern from paymentverse-site 0a903d8.)
    onAfterTask: (a: any, result: any) => {
      try {
        SESSION_LOG.push(
          `${result?.success ? 'DONE' : 'FAILED'}: "${String(a?.task || '').slice(0, 100)}" → ${String(result?.data || '').slice(0, 120)}`
        )
      } catch {
        /* session log must never break the task */
      }
      try {
        const q = new URLSearchParams({
          ok: result?.success ? '1' : '0',
          steps: String(result?.history?.filter((h: any) => h.type === 'step').length ?? ''),
          path: location.pathname,
          task: String(a?.task || '').slice(0, 180),
        })
        navigator.sendBeacon?.('/api/agent-log?' + q.toString())
      } catch {
        /* telemetry must never break the task */
      }
    },
    customTools: {
      // Same-name override of the built-in scroll tool (the documented
      // extension point). The library's ancestor walk stops at <body> and
      // never treats the document itself as scrollable, so any indexed
      // scroll on a normal page returns "No scrollable container found"
      // (verified live 2026-07-15) — and the OpenAI-lane strict tool
      // schema means the model always sends an index. Delegate to the
      // library first, then fall back to an instant window scroll with an
      // honest read-back.
      scroll: tool({
        description:
          'Scroll vertically. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.',
        inputSchema: z.object({
          down: z.boolean().default(true),
          num_pages: z.number().min(0).max(10).optional().default(0.1),
          pixels: z.number().int().min(0).optional(),
          index: z.number().int().min(0).optional(),
        }),
        execute: async function (this: any, input: any) {
          const result = await this.pageController.scroll({
            ...input,
            numPages: input.num_pages,
          })
          if (!result.message.includes('No scrollable container found'))
            return result.message
          // || not ??: the strict-schema model sends pixels/num_pages of 0
          // to mean "unused", and a 0px scroll wastes a step.
          const magnitude =
            input.pixels || (input.num_pages || 0.1) * window.innerHeight
          const dy = (input.down === false ? -1 : 1) * magnitude
          const before = window.scrollY
          window.scrollBy({ top: dy, behavior: 'instant' as ScrollBehavior })
          await new Promise((resolve) => setTimeout(resolve, 100))
          const scrolled = Math.round(window.scrollY - before)
          if (Math.abs(scrolled) < 1)
            return dy > 0
              ? '⚠️ Already at the bottom of the page, cannot scroll down further.'
              : '⚠️ Already at the top of the page, cannot scroll up further.'
          return `✅ Scrolled page by ${scrolled}px.`
        },
      }),
    },
  })

  // ask_user tool needs a UI surface. The stock Panel used to provide this;
  // now the face owns it. Sensible default so contact-form fill still works
  // before a richer face is wired — a face may override engine.onAskUser.
  engine.onAskUser = (question: string) => window.prompt(question) || ''

  // The library verifies scrolls by an immediate scrollY read-back, which our
  // global scroll-behavior:smooth defeats (reads 0, reports a false failure).
  // Scroll instantly while a task runs, restore after. Engine-level behaviour,
  // not a face concern — stays here.
  engine.addEventListener('statuschange', () => {
    document.documentElement.style.scrollBehavior =
      engine.status === 'running' ? 'auto' : ''
  })

  ;(window as any).pageAgent = engine
  return engine
}
