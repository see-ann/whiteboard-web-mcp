# whiteboard-web-mcp — requirements

WebMCP Challenge submission. An agent-native whiteboard: a canvas that humans draw on
directly and agents manipulate through structured WebMCP tools, in the same session,
on the same state.

---

## 1. hackathon facts (source of truth)

| item | value |
|---|---|
| Hackathon | The WebMCP Challenge (Devpost, managed by Devpost, sponsored by OpenAI) |
| URL | https://webmcp.devpost.com/ |
| Deadline | **Sep 4, 2026 @ 4:00am EDT** — page reads "about 12 hours to deadline" as of Sep 3 |
| Prize pool | $35,000 cash; **top 10 each**: $3,000 cash + Codex Micro + ChatGPT Pro (1 yr, up to 3 members) + OpenAI swag |
| Sponsor add-ons per winner | Cloudflare $10k credits · Vercel $3,600 + $600 credits · Render $300 · Netlify $500 cash · Shopify $250 gear · Google AI Ultra 3 months per member |
| Participants | ~6,820 |
| Eligibility | Above legal age of majority in country of residence; some countries excluded |

### deliverables (all required)

1. **Live URL** reachable by judges in ChatGPT's in-app browser or Chrome with WebMCP enabled.
   Auth is allowed if credentials are supplied on the submission form. Prefer **no auth** for judging.
2. **Text description** covering, explicitly:
   - why this use case is a strong fit for WebMCP
   - how it creates a better user experience
   - what people and agents can do together that was hard/impossible before
   - how WebMCP was implemented
3. **Demo video** — public YouTube, **under 3 minutes**, with **audio**, showing a clear demo of
   what was built and how WebMCP was used.
4. **Public repo** (GitHub/GitLab/Bitbucket) containing all source, assets, and run instructions,
   with an **OSI license file detectable in the repo About section** (use `LICENSE`, MIT).
   Repo must contain real `registerTool` calls.

### judging criteria (weight our effort accordingly)

- **WebMCP Leverage** — thorough, skillful, non-trivial use. Not a token wrapper around one button.
- **Execution** — complete, coherent product; not a proof of concept.
- **Potential Impact** — credible, specific real problem for a real audience.
- **Creativity & Ambition** — novel vs. existing concepts.

### judges (informs framing)

Cloudflare (Andrew Galloni), MCP-B creator (Alex Nahas), Shopify (Ilya Grigorik),
Vercel/Next.js (Jude Gao), OpenAI Browser Platform (Justin Rushing),
Chrome (Sarah Drasner), Netlify (Sean Roberts).

Implication: the audience is browser-platform and standards people. They will read the code
and care about **correct, idiomatic spec usage**, tool ergonomics, and whether the tool surface
is something an agent can actually plan over.

---

## 2. WebMCP technical facts (verified against spec + Chrome docs)

> **Important correction to the Devpost page.** The Devpost requirements snippet shows
> `document.modelContext.registerTool({...})`. Both forms appear in the ecosystem —
> the W3C draft and Chrome's imperative-API docs use `document.modelContext`, while much
> secondary writing references `navigator.modelContext`. **We must feature-detect both**
> and bind to whichever exists, so we work in ChatGPT's in-app browser and in Chrome
> regardless of which surface that build ships.

### API surface

```js
const controller = new AbortController();

await mc.registerTool({
  name: "add_note",
  description: "Add a sticky note to the board",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Note body" },
      x:    { type: "number", description: "Board-space x coordinate" },
      y:    { type: "number", description: "Board-space y coordinate" }
    },
    required: ["text"]
  },
  annotations: {
    readOnlyHint: false,          // true for pure queries
    untrustedContentHint: true    // true when returning user-authored board content
  },
  async execute({ text, x, y }, { signal }) {
    const note = board.addNote({ text, x, y });
    return { content: [{ type: "text", text: `Created note ${note.id}` }] };
  }
}, { signal: controller.signal });
```

- **Registration**: `registerTool(descriptor, { signal, exposedTo })`. Returns a promise.
- **Unregistration**: abort the `AbortController` passed as `signal`. In-flight executions
  are not broken. (`unregisterTool` exists in newer builds; abort is the portable path.)
- **Return shape**: `{ content: [{ type: "text", text: string }] }`. Some builds tolerate a
  bare string — always return the structured form.
- **`execute` second arg**: `{ signal }` — honor it for long operations.
- **Discovery/manual invocation**: `getTools({ fromOrigins })`, `executeTool(tool, jsonArgs, { signal })`,
  and a `toolchange` event. Useful if we ever embed a cross-origin panel; not needed for MVP.
- **`exposedTo`**: array of origins allowed to see a tool. Omit for MVP.
- **`provideContext()` / `clearContext()` are REMOVED** (March 2026 spec revision).
  Do not use them; `registerTool`/`unregisterTool` are the only declaration path.
- **Declarative API** also exists (annotating HTML forms). Optional bonus surface.

### hard constraints

- **HTTPS only.** No WebMCP on `http://`. Local dev must use `localhost` (treated as secure)
  or an HTTPS tunnel.
- **Chrome 146+** behind `chrome://flags/#enable-webmcp-testing`; Chrome 149+ has an origin trial.
- **ChatGPT in-app browser** supports WebMCP out of the box — this is the primary judging path.
- Gated by **origin isolation** and the **`tools` Permissions Policy** (default `self`).
  Cross-origin iframes need `allow="tools"`.

### testing paths

1. ChatGPT in-app browser (primary — this is how judges will look at it).
2. Chrome with `chrome://flags/#enable-webmcp-testing` enabled.
3. Our own in-page **agent console** fallback (see §5) so the demo works even if a judge's
   browser lacks the flag — this de-risks the entire submission.

---

## 3. product concept

### the problem

Whiteboards are the highest-bandwidth medium for thinking and the lowest-bandwidth medium
for machines. A board full of sticky notes, arrows, and boxes is *semantically rich to a
human and opaque to software*. Today an agent's only routes in are (a) screenshot + vision,
which is lossy and cannot reliably write back, or (b) a bespoke server API the agent must be
pre-integrated with. Neither lets an agent join a board that a person is *currently* working on.

### the thesis

A whiteboard is the ideal WebMCP surface because its state is **already a structured graph**
(nodes, edges, groups, positions) that happens to be *rendered* visually. WebMCP lets us hand
the agent the graph directly while the human keeps the pixels. Same document, two modalities,
no sync layer, no screenshots, no API keys.

### recommended primary concept — **agent-native structured canvas**

Board state is a typed graph. The agent gets tools to read it, mutate it, lay it out, and
reason about it; the human gets a normal direct-manipulation whiteboard. Neither is a
second-class citizen.

What becomes possible that was hard before:

- "Turn my scattered notes into a system diagram" — agent reads 40 notes, clusters them,
  creates boxes and arrows, runs auto-layout, all while you watch shapes appear.
- "What's missing from this architecture?" — agent traverses the actual edge list, not a
  screenshot, and adds a red note next to each gap it finds.
- "Group these by theme and label the groups" — genuine affinity-mapping the agent can do
  because it can read every note's text and write back group boundaries.
- You drag a box while the agent is working; there's no conflict, because you're both
  editing one in-memory document through the same command layer.

Two credible alternatives, kept on the table until concept lock:

- **B — collaborative brainstorm / affinity board.** Sticky notes only. Simpler geometry,
  cleaner "human + agent in the same room" story, weaker on Creativity & Ambition.
- **C — whiteboard as the agent's own workspace.** The canvas is where the agent shows its
  reasoning: it spawns plan nodes, links sources, and you rearrange to steer it. Most novel,
  highest execution risk.

The recommended concept subsumes most of B and can grow into C via a "plan mode" tool set.

### target audience

Anyone who runs a design review, an architecture session, a retro, or a research synthesis
on a shared canvas — and who now has an agent sitting next to them in the browser.

---

## 4. tool surface (the core of the WebMCP Leverage score)

Design principles:

- **Tools are intents, not setters.** `cluster_by_theme` beats `set_note_position` × 40.
- **Every tool returns board state deltas as text** the agent can plan on — ids, not prose.
- **Reads are cheap and complete**; writes are coarse and idempotent where possible.
- **`readOnlyHint: true` on all queries** so agents can call them freely.
- **`untrustedContentHint: true` on anything returning human-authored note text** — this is
  correct hygiene and the standards judges will notice its absence.
- Stable, human-meaningful ids (`note_7`, `box_3`) so agent plans stay readable.

### read tools

| tool | purpose |
|---|---|
| `get_board_summary` | Counts by type, groups, bounding box, current viewport. The agent's cheap first call. |
| `list_elements` | All elements with id, type, text, position, size, style, group. Supports `filter` by type/group/text-match. |
| `get_element` | Full detail for one id, including inbound/outbound edges. |
| `get_connections` | Edge list as `(from_id, label, to_id)` triples — the graph view. |
| `find_elements` | Semantic/substring search over note and label text. |
| `export_board` | Full JSON snapshot. Escape hatch for anything not covered. |

### write tools — elements

| tool | purpose |
|---|---|
| `create_note` | Sticky note: text, optional x/y, color. Auto-places if position omitted. |
| `create_shape` | Rect / ellipse / diamond with label. |
| `create_text` | Free text label. |
| `create_frame` | Named region/container. |
| `update_element` | Change text, color, size, position of an existing id. |
| `delete_elements` | Remove by id list. |
| `create_batch` | **Key tool.** Create many elements + connections in one call — this is how an agent generates a whole diagram in one turn instead of 30 round trips. |

### write tools — structure

| tool | purpose |
|---|---|
| `connect_elements` | Draw an arrow from → to, optional label, optional style. |
| `disconnect_elements` | Remove an edge. |
| `group_elements` | Put ids into a named group / frame. |
| `arrange_elements` | Layout: `grid`, `hierarchy`, `radial`, `columns-by-group`, `flow`. Runs a real layout pass. |
| `align_elements` | Align/distribute a selection. |

### write tools — high-level intents (the differentiators)

| tool | purpose |
|---|---|
| `cluster_notes` | Agent supplies theme→note-id assignments; we create frames, recolor, and lay out columns. Turns messy ideation into an affinity map in one call. |
| `annotate_element` | Attach a visible agent comment badge to an element — how the agent gives feedback *on the canvas* rather than in chat. |
| `highlight_elements` | Temporarily spotlight ids so the human's eye follows the agent's reasoning. Huge for the demo video. |
| `focus_viewport` | Pan/zoom to an element, group, or bounding box. Lets the agent *drive the camera* while narrating. |
| `set_board_mode` | Switch board template (brainstorm / architecture / retro / user-journey), which changes defaults and palette. |

### session / provenance tools

| tool | purpose |
|---|---|
| `undo_last_agent_action` | Reverses the last agent-originated command batch only, leaving human edits intact. |
| `get_agent_activity` | Log of what the agent has done this session, with element ids. |

Target: **~25 tools**, every one wired to real behavior. Depth here is directly what
"WebMCP Leverage" is scored on.

---

## 5. architecture

```
src/
  webmcp/
    bind.ts        # feature-detect document.modelContext | navigator.modelContext
    register.ts    # registers all tools, returns AbortController for teardown
    tools/         # one module per tool group; each exports a descriptor
    result.ts      # helpers: ok(text), err(text) -> { content: [...] }
  board/
    store.ts       # zustand store; single source of truth
    commands.ts    # ALL mutations go through here (human + agent)
    layout.ts      # grid / hierarchy / radial / flow algorithms
    types.ts
  canvas/          # React renderer + direct-manipulation interactions
  ui/
    AgentActivity.tsx   # live feed of agent tool calls
    ToolInspector.tsx   # dev panel: registered tools + last call/result
    AgentConsole.tsx    # fallback in-page tool invoker (see below)
  persist/
    local.ts       # localStorage autosave
```

**Non-negotiable design rule: one command layer.** Human drags and agent tool calls both
produce the same command objects against the same store. This is what makes "human and agent
edit the same document" true rather than a claim, and it makes undo/provenance fall out for free.

**Provenance.** Every element carries `origin: "human" | "agent"` and a `sessionActionId`.
Agent-created elements get a subtle marker. This makes the collaboration *visible* on screen —
strong for both the demo video and the "better UX" narrative.

**Fallback agent console (risk mitigation).** A built-in panel that lists the registered tool
descriptors and lets anyone invoke them with JSON args, showing the returned content. If a judge
opens the URL in a browser without WebMCP, they still see the full tool surface working. It also
doubles as the dev harness. Cheap to build, disproportionately protective of the Execution score.

### stack (locked)

- **Vite + React + TypeScript**
- **zustand** for board state
- Canvas via **SVG** (crisp, hit-testing is trivial, exports cleanly). Reconsider only if perf bites.
- **Cloudflare Pages** for hosting — HTTPS by default, and Cloudflare is the largest sponsor prize.
- No backend required for MVP. `localStorage` persistence.
- Optional later: Cloudflare Durable Objects for multiplayer.

---

## 6. build phases

**Phase 0 — spike (do this first, before anything else).**
Deploy a one-page site to Cloudflare Pages that registers a single `create_note` tool and
renders the note. Open it in the ChatGPT in-app browser and confirm the tool is discovered
and callable. *Everything else is worthless if this doesn't work.* Do not build the canvas
until this is green.

**Phase 1 — board core.** Types, store, command layer, SVG renderer, pan/zoom, create/move/
edit/delete notes and shapes, arrows, selection, localStorage.

**Phase 2 — tool surface.** All read tools, then element writes, then structure, then intents.
Ship the tool inspector alongside so each tool is verified as written.

**Phase 3 — collaboration polish.** Provenance markers, agent activity feed, highlight +
focus_viewport animations, agent-scoped undo, board templates.

**Phase 4 — layout engine.** Real hierarchy/flow/radial layout. This is what makes agent-
generated diagrams look designed instead of dumped.

**Phase 5 — submission.** README with setup + WebMCP explanation, MIT `LICENSE` at repo root,
deploy, record demo, write the Devpost text against the four required bullets.

**Stretch (only if everything above is done):** multiplayer via Durable Objects; declarative
API annotations as a second surface; PNG/SVG export tool; import from Markdown/Mermaid.

---

## 7. risks

| risk | mitigation |
|---|---|
| `document` vs `navigator.modelContext` divergence | Feature-detect both at bind time. Non-negotiable. |
| Judge's browser lacks WebMCP | In-page agent console fallback + say so in the README. |
| ChatGPT in-app browser behaves differently than Chrome | Test there in Phase 0, not at the end. |
| Too many shallow tools reads as padding | Every tool must be reachable in a real demo scenario; cut any that isn't. |
| Canvas work eats all the time | tldraw is the escape hatch if Phase 1 slips badly — wrap its editor API instead of building primitives. |
| Deadline ambiguity (page shows ~12h) | **Confirm the real deadline before planning past it.** If it is genuinely ~12h, cut to Phases 0–2 plus submission. |

---

## 8. open decisions

1. **Concept lock** — recommended concept vs. B (brainstorm) vs. C (agent workspace).
2. **Real deadline** — the Devpost page shows both "10 days" and "~12 hours to deadline".
3. **Canvas from scratch vs. tldraw** — affects the "genuine effort" read of the code.
4. **Multiplayer** — in or out of scope.

---

## 9. demo script (write the video around this; under 3 minutes)

1. Empty board. Human types three sticky notes by hand. (~15s)
2. Agent: *"read the board and add the pieces we're missing for a checkout flow."*
   Notes appear one by one, arrows connect them. (~40s)
3. Agent: *"group these by theme and lay it out."* `cluster_notes` + `arrange_elements` —
   the board visibly reorganizes. (~30s)
4. Human drags a box mid-operation to show live shared editing. (~10s)
5. Agent: *"what's missing?"* — annotation badges appear on specific elements, camera pans
   to each via `focus_viewport`. (~40s)
6. Show the tool inspector: ~25 registered tools, live call log. (~15s)
