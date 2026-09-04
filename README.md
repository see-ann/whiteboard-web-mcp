# Agent Whiteboard

A whiteboard that people draw on and agents edit — at the same time, on the same
canvas, with no server, no API keys and no screenshots.

**Live: <https://agent-whiteboard.see-ann.workers.dev>**

Built with [WebMCP](https://github.com/webmachinelearning/webmcp), the W3C draft
that lets a page hand structured tools directly to an AI agent running in the
browser.

> [!IMPORTANT]
> WebMCP is experimental. It needs ChatGPT's built-in browser (`Cmd+Shift+B` in
> the desktop app), or Chrome with `chrome://flags/#enable-webmcp-testing`
> enabled.

## Why a whiteboard

A board full of sticky notes, boxes and arrows is rich to a human and opaque to
software. An agent's only ways in today are screenshots, which are lossy and
cannot reliably write back, or a bespoke server integration it must be wired up
to in advance.

But a whiteboard's state is **already a structured graph** — nodes, edges,
positions — that merely happens to be rendered visually. WebMCP hands the agent
that graph directly and leaves the pixels to the person.

Agent whiteboards already exist. FigJam has one, and there are several Excalidraw
MCP servers. All of them are *prompt in, diagram out*: an agent somewhere else
sends a description to a server and gets a canvas back. Nobody is standing at the
board.

The difference here is presence. The agent joins a board **you are already
looking at**, sees the shapes you drew by hand, and edits alongside you. There is
no install, no config file, no API key — you open a URL and it is in the room
with you.

## WebMCP tools

| Tool               | Available when      | Purpose                                                        |
| ------------------ | ------------------- | -------------------------------------------------------------- |
| `create_note`      | always              | Add a sticky note. Omit `x`/`y` to place it automatically       |
| `create_shape`     | always              | Draw a labelled rectangle, ellipse or diamond                   |
| `create_diagram`   | always              | Build a whole flow — boxes and arrows — in one call             |
| `list_elements`    | board has elements  | Every element with its ID, type, position and text              |
| `connect_elements` | board has 2+        | Arrow between two elements, bound so it follows them            |

Every tool calls the same functions the on-screen canvas uses, so an agent's
edits and a person's hand-drawn shapes land on one board with one undo history.

## Design decisions

**The tool list changes with the board.** `connect_elements` is meaningless on an
empty canvas, so it is not registered until there are two things to connect. This
follows Chrome's guidance to register tools only while relevant to page state —
and it is the capability a backend MCP server structurally lacks, since its tool
list is fixed at startup. The header reports the live count, so you can watch it
go 3 → 4 → 5 as the board fills.

**One call for a whole diagram.** Excalidraw accepts caller-supplied IDs, so
`create_diagram` builds nodes and the arrows between them in a single pass: the
agent names each node with a short key and edges reference those keys. A ten-box
diagram costs one tool call rather than twenty round trips.

**Position is optional.** Requiring coordinates would force the agent to do
layout arithmetic on every call and stack elements on top of each other. Omitting
them hands placement to the app.

**Reads are annotated `readOnlyHint`** so an agent may call them freely, and
`untrustedContentHint` because element text is written by whoever shares the
board. It must reach the model as data, never as instructions — a note reading
"ignore your previous instructions" is content, not a command.

**There is no delete tool.** Not an omission: an agent cannot be talked into
calling a tool that does not exist. On a shared board, the worst a malicious note
can achieve is bounded by the surface you expose.

**Agent edits are undoable.** Writes use `CaptureUpdateAction.IMMEDIATELY` rather
than Excalidraw's default, so anything an agent gets wrong can be reverted with
one keystroke by the person watching.

**Excalidraw owns board state.** `useBoard` holds a handle to it rather than a
copy of the elements, so there is one source of truth and reads can never go
stale after someone drags a shape. Actions read that handle through a ref,
because an agent can fire tool calls faster than React re-renders.

**Registration probes both surfaces.** Chrome and the W3C draft expose the model
context on `document`, but agents built against earlier drafts look for it on
`navigator` — and report a page as having no tools at all when only the other is
populated. The header shows which surface was found.

## Run locally

Requires Node 24+.

```bash
npm install
npm run start
```

Open <http://localhost:5173> in ChatGPT's built-in browser or in Chrome with
WebMCP testing enabled. The header shows **5 WebMCP tools ready** once
registration succeeds; hover it to see the surface and tool names.

Then ask the agent:

```
draw me a checkout flow diagram
add a diamond that says "payment valid?"
what's on the board?
```

Draw a shape by hand first, then ask what's on the board — the agent sees your
shape too. Connect two shapes, then drag one: the arrow follows.

### Other commands

```bash
npm run lint     # Biome check
npm run format   # Biome check and fix
npm run build    # production build
npm run deploy   # build and deploy to Cloudflare Workers
```

## Built with

[Excalidraw](https://github.com/excalidraw/excalidraw) for the canvas, React and
Vite, deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/).
Scaffolded from Cloudflare's
[WebMCP React starter](https://github.com/cloudflare/agents/tree/main/examples/webmcp-react).

## License

MIT — see [LICENSE](./LICENSE).
