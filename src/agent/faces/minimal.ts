/*
  MINIMAL face — the interim placeholder.

  Deliberately plain: a launcher button, an input, three suggestion chips, a
  status line, and an inline ask_user prompt. Its only jobs are to prove the
  engine/face seam works and to keep the assistant reachable while the real
  face (a Rive bot, a text-bubble, …) is chosen. Swap it out by pointing
  PageAgentWidget.astro at a different AgentFace — nothing here leaks into the
  engine.

  DOM-friendly by construction (see AGENTS.md): real <button>/<input> with
  aria-labels, visible text state — so a visiting agent can operate it too.

  The opener line is Jay's copy, preserved verbatim from the previous
  vendor-panel graft. RH is dual-theme, so the styling (in
  PageAgentWidget.astro) rides the site tokens rather than a fixed palette.
*/
import type { PageAgentCore } from '@page-agent/core'
import type { AgentFace } from '../face'
import { activityOf } from '../face'

// Jay's opener copy — preserved verbatim. Shown until the first task runs.
const OPENER =
  'Hi — I don’t come with memory. I’m discovering this site for the first time, just like you. Watch me work, or put me to work:'

// Page-agnostic chips (the widget mounts on every page).
const CHIPS: Array<[string, string]> = [
  ['What is Remotely Human?', 'Briefly explain what Remotely Human is, from this site.'],
  ['Show me around', 'Give me a quick tour of this page: scroll through its main sections one by one, briefly explaining each.'],
  ['Talk to the team', 'Help me get in touch with the team.'],
]

export const minimalFace: AgentFace = {
  id: 'minimal',
  mount(engine: PageAgentCore) {
    const root = document.createElement('div')
    root.id = 'rh-face-minimal'
    root.innerHTML = `
      <button id="rhf-launch" type="button" aria-label="Open the Remotely Human assistant" aria-expanded="false">Ask AI</button>
      <div id="rhf-panel" role="dialog" aria-label="Remotely Human assistant" hidden>
        <p id="rhf-status">${OPENER}</p>
        <div id="rhf-chips"></div>
        <form id="rhf-form">
          <input id="rhf-input" type="text" autocomplete="off"
            aria-label="Ask about Remotely Human" placeholder="Ask about Remotely Human…" />
          <button type="submit" aria-label="Send">Send</button>
        </form>
      </div>`
    document.body.appendChild(root)

    const launch = root.querySelector<HTMLButtonElement>('#rhf-launch')!
    const panel = root.querySelector<HTMLDivElement>('#rhf-panel')!
    const status = root.querySelector<HTMLParagraphElement>('#rhf-status')!
    const form = root.querySelector<HTMLFormElement>('#rhf-form')!
    const input = root.querySelector<HTMLInputElement>('#rhf-input')!
    const chips = root.querySelector<HTMLDivElement>('#rhf-chips')!

    for (const [label, task] of CHIPS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.addEventListener('click', () => run(task))
      chips.appendChild(b)
    }

    const open = (v: boolean) => {
      panel.hidden = !v
      launch.setAttribute('aria-expanded', String(v))
      if (v) input.focus()
    }
    launch.addEventListener('click', () => open(panel.hidden))

    const run = (task: string) => {
      if (!task.trim() || engine.status === 'running') return
      chips.hidden = true
      engine.execute(task).catch(() => {})
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      run(input.value)
      input.value = ''
    })

    // ask_user: a nicer surface than the engine's window.prompt default.
    engine.onAskUser = (question: string) =>
      new Promise<string>((resolve) => {
        status.textContent = question
        open(true)
        const onSubmit = (e: Event) => {
          e.preventDefault()
          form.removeEventListener('submit', onSubmit)
          const v = input.value
          input.value = ''
          resolve(v)
        }
        form.addEventListener('submit', onSubmit)
      })

    // Reflect the real activity stream as visible text.
    const onActivity = (e: Event) => {
      const a = activityOf(e)
      if (!a) return
      status.textContent =
        a.type === 'thinking' ? 'Thinking…'
        : a.type === 'executing' ? `Working: ${a.tool}…`
        : a.type === 'executed' ? `Did: ${a.tool}`
        : a.type === 'retrying' ? `Retrying (${a.attempt}/${a.maxAttempts})…`
        : a.type === 'error' ? `Error: ${a.message}`
        : status.textContent
    }
    const onStatus = () => {
      if (engine.status === 'idle' || engine.status === 'completed')
        status.textContent = 'Ask me anything about Remotely Human.'
    }
    engine.addEventListener('activity', onActivity)
    engine.addEventListener('statuschange', onStatus)

    return () => {
      engine.removeEventListener('activity', onActivity)
      engine.removeEventListener('statuschange', onStatus)
      root.remove()
    }
  },
}
