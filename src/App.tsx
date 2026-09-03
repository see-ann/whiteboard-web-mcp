import { Badge, Button } from "@cloudflare/kumo";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { MoonIcon, RobotIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useBoard } from "./useBoard";

type BoardStatus = {
  label: string;
  detail: string;
  dot: string;
  text: string;
};

function statusView(ready: boolean): BoardStatus {
  if (ready) {
    return {
      label: "Canvas ready",
      detail: "Excalidraw imperative API attached",
      dot: "bg-green-500",
      text: "text-kumo-success"
    };
  }
  return {
    label: "Loading canvas…",
    detail: "Waiting for the Excalidraw API",
    dot: "bg-yellow-500",
    text: "text-kumo-warning"
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

  const status = statusView(actions.ready);

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
        <Excalidraw excalidrawAPI={setApi} theme={mode} />
      </main>
    </div>
  );
}
