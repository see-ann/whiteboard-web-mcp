import { Badge, Button } from "@cloudflare/kumo";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI
} from "@excalidraw/excalidraw/types";
import {
  FilePlusIcon,
  MoonIcon,
  RobotIcon,
  SunIcon
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HorizontalScrollbar,
  type ViewportBounds
} from "./HorizontalScrollbar";
import { clearScene, loadScene, saveScene } from "./storage";
import { useBoard } from "./useBoard";
import { useWebMCPTools, type WebMCPToolsState } from "./useWebMCPTools";

type BoardStatus = {
  label: string;
  detail: string;
  dot: string;
  text: string;
};

function statusView(state: WebMCPToolsState): BoardStatus {
  if (state.error) {
    return {
      label: "WebMCP registration failed",
      detail: state.error.message,
      dot: "bg-red-500",
      text: "text-kumo-danger"
    };
  }
  if (state.registered) {
    return {
      label: `${state.toolNames.length} WebMCP tools ready`,
      detail: `${state.surface} — ${state.toolNames.join(", ")}`,
      dot: "bg-green-500",
      text: "text-kumo-success"
    };
  }
  if (state.supported) {
    return {
      label: "Registering WebMCP tools…",
      detail: "document.modelContext",
      dot: "bg-yellow-500",
      text: "text-kumo-warning"
    };
  }
  return {
    label: "WebMCP testing is not enabled",
    detail: "chrome://flags/#enable-webmcp-testing",
    dot: "bg-kumo-inactive",
    text: "text-kumo-subtle"
  };
}

function ModeToggle({
  mode,
  setMode
}: {
  mode: "light" | "dark";
  setMode: (mode: "light" | "dark") => void;
}) {
  useEffect(() => {
    document.documentElement.setAttribute("data-mode", mode);
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem("theme", mode);
  }, [mode]);

  return (
    <Button
      variant="ghost"
      shape="square"
      aria-label="Toggle theme"
      onClick={() => setMode(mode === "light" ? "dark" : "light")}
      icon={mode === "light" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
    />
  );
}

export default function App() {
  const { setApi, actions } = useBoard();
  const [mode, setMode] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  // Drives dynamic registration: tools that operate on existing elements are
  // registered only once the board actually holds some.
  const [elementCount, setElementCount] = useState(0);

  // Read once on mount. Excalidraw owns the scene from then on, so re-reading
  // storage later would fight whatever is already on the canvas.
  const [restored] = useState(loadScene);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [bounds, setBounds] = useState<ViewportBounds | null>(null);
  const [api, setApiState] = useState<ExcalidrawImperativeAPI | null>(null);

  // useBoard keeps its handle private for the tools; the scrollbar needs one
  // too, so both are set from the same callback.
  const handleApi = useCallback(
    (excalidrawApi: ExcalidrawImperativeAPI) => {
      setApi(excalidrawApi);
      setApiState(excalidrawApi);
    },
    [setApi]
  );

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      // Count what an agent could actually connect. A labelled shape is two
      // elements — the container and its bound text — and arrows are not
      // connection targets, so counting either made connect_elements appear
      // while there was still only one shape on the board.
      setElementCount(
        elements.filter(
          (element) =>
            element.type !== "arrow" &&
            element.type !== "line" &&
            !("containerId" in element && element.containerId)
        ).length
      );

      // Pan and zoom live in appState, not in the elements, so saving only the
      // elements restored the board at whatever the default camera was.
      const { scrollX, scrollY, zoom } = appState;

      // Board coordinates the scrollbar needs: where the view sits, and how far
      // the drawing extends either side of it.
      const lefts = elements.map((element) => element.x);
      const rights = elements.map((element) => element.x + element.width);
      setBounds({
        left: -scrollX,
        width: appState.width / zoom.value,
        contentLeft: lefts.length ? Math.min(...lefts) : -scrollX,
        contentRight: rights.length
          ? Math.max(...rights)
          : -scrollX + appState.width / zoom.value
      });

      // onChange fires on every pointer move during a drag, so writing on each
      // one stutters the canvas. Save once the board has been still a moment.
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(
        () => saveScene(elements, { scrollX, scrollY, zoom }),
        500
      );
    },
    []
  );

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const startNewBoard = useCallback(() => {
    clearScene();
    location.reload();
  }, []);

  const webMCP = useWebMCPTools(actions, elementCount);
  const status = statusView(webMCP);

  return (
    <div className="flex h-screen flex-col bg-kumo-elevated">
      <header className="shrink-0 border-b border-kumo-line bg-kumo-base px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <RobotIcon size={22} weight="bold" className="text-kumo-accent" />
            <h1 className="text-lg font-semibold text-kumo-default">
              Agent Whiteboard
            </h1>
            <Badge variant="secondary">experimental</Badge>
          </div>
          <output
            className="ml-auto flex items-center gap-2"
            title={status.detail}
            aria-live="polite"
          >
            <span className={`size-2 rounded-full ${status.dot}`} />
            <span className={`text-xs ${status.text}`}>{status.label}</span>
          </output>
          {/* Clearing the board is a human action only: no tool can do it, so
              a note telling an agent to wipe the canvas has nothing to call. */}
          <Button
            variant="ghost"
            shape="square"
            aria-label="New board"
            title="New board"
            onClick={startNewBoard}
            icon={<FilePlusIcon size={16} />}
          />
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={handleApi}
          theme={mode}
          initialData={
            restored
              ? { elements: restored.elements, appState: restored.viewport }
              : null
          }
          onChange={handleChange}
        />
        <HorizontalScrollbar api={api} bounds={bounds} />
      </main>
    </div>
  );
}
