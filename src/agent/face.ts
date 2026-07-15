/*
  Agent FACE contract — the swappable visual layer.

  The engine (engine.ts, a headless PageAgentCore) knows nothing about how it
  looks. A face is any module that takes the engine and gives it a body:
  a launcher, an input surface, status/output display, an ask_user prompt.

  Swap the face by pointing PageAgentWidget.astro at a different implementation
  — a Rive bot, a text-bubble chat panel, the stock @page-agent/ui Panel,
  anything. Nothing in the engine changes.

  What a face is responsible for (what the old stock Panel used to give us):
    1. A way to start tasks       → call `engine.execute(task)`
    2. An ask_user prompt surface → set `engine.onAskUser = (q) => …`
       (the engine ships a window.prompt default; override for something nicer)
    3. Reflecting live state       → listen to 'activity' and 'statuschange'

  The engine emits (all via standard EventTarget):
    - 'statuschange' → engine.status: 'idle'|'running'|'completed'|'error'|'stopped'
    - 'activity'     → e.detail: AgentActivity — the real tool-by-tool stream
                       ('thinking' | 'executing' | 'executed' | 'retrying' | 'error').
      This is the beat a bot binds to: nod/think while executing, show words
      on 'executed' output, etc.
*/
import type { PageAgentCore, AgentActivity } from '@page-agent/core'

export type { AgentActivity }

export interface AgentFace {
  /** A short id for config/telemetry, e.g. 'minimal', 'rive-bot'. */
  readonly id: string
  /**
   * Attach the face to the engine and render it. May return a disposer to
   * tear the face down (remove DOM, drop listeners) when swapping faces.
   */
  mount(engine: PageAgentCore): void | (() => void)
}

/** Narrow an 'activity' event's detail to the typed AgentActivity union. */
export function activityOf(e: Event): AgentActivity | undefined {
  return (e as CustomEvent<AgentActivity>).detail
}
