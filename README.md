# Agent Whiteboard

A whiteboard that people draw on and agents edit — at the same time, on the same
canvas, with no server, no API keys and no screenshots.

Built with [WebMCP](https://github.com/webmachinelearning/webmcp), the W3C draft
that lets a page hand structured tools directly to an AI agent running in the
browser.

> [!IMPORTANT]
> WebMCP is experimental. It needs ChatGPT's built-in browser, or Chrome with
> `chrome://flags/#enable-webmcp-testing` enabled.

## Why a whiteboard

A board full of sticky notes, boxes and arrows is rich to a human and opaque to
software. An agent's only ways in today are screenshots, which are lossy and
cannot reliably write back, or a bespoke server integration it must be wired up
to in advance.

But a whiteboard's state is **already a structured graph** — nodes, edges,
positions — that merely happens to be rendered visually. WebMCP hands the agent
that graph directly and leaves the pixels to the person.

The result is an agent that can join a board you are *currently looking at*,
with no setup: you open a URL and it is already in the room with you.

## WebMCP tools

| Tool            | Purpose                                                          |
| --------------- | ---------------------------------------------------------------- |
| `create_note`   | Add a sticky note. Omit `x`/`y` to place it automatically         |
| `list_elements` | Every element with its ID, type, position and text                |

Both call the same functions the on-screen canvas uses, so an agent's edits and
a person's hand-drawn shapes land on one board with one undo history.

## Design decisions

**Position is optional.** Requiring coordinates would force the agent to do
layout arithmetic on every call and stack notes on top of each other. Omitting
them hands placement to the app, which lays notes out in a grid.

**Reads are annotated `readOnlyHint`** so an agent may call them freely, and
`untrustedContentHint` because element text is written by whoever shares the
board. It must reach the model as data, never as instructions — a note reading
"ignore your previous instructions" is content, not a command.

**Agent edits are undoable.** Writes use `CaptureUpdateAction.IMMEDIATELY`
rather than Excalidraw's default, so anything an agent gets wrong can be
reverted with one keystroke by the person watching.

**Excalidraw owns board state.** `useBoard` holds a handle to it rather than a
copy of the elements, so there is one source of truth and reads can never go
stale after someone drags a shape.

## Run locally

Requires Node 24+.

```bash
npm install
npm run start
```

Open <http://localhost:5173> — in ChatGPT's built-in browser (`Cmd+Shift+B` in
the desktop app), or in Chrome with WebMCP testing enabled. The header shows
**WebMCP tools ready** once registration succeeds.

Then ask the agent:

```
add a note that says buy milk
add notes for: login, checkout, payment, confirmation
what's on the board?
```

Draw a shape by hand first, then ask what's on the board — the agent sees your
shape too.

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
