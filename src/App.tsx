import { Badge, Button } from "@cloudflare/kumo";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { MoonIcon, RobotIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
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
      detail: state.toolNames.join(", "),
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
          <ModeToggle mode={mode} setMode={setMode} />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={setApi}
          theme={mode}
          onChange={(elements) => setElementCount(elements.length)}
        />
      </main>
    </div>
  );
}
