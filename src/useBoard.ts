import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useRef, useState } from "react";

export type BoardActions = {
  /** True once Excalidraw has handed over its imperative API. */
  ready: boolean;
};

/**
 * Owns the Excalidraw imperative API handle.
 *
 * Excalidraw itself is the source of truth for board state, so this hook holds
 * a handle to it rather than a copy of the elements. Every WebMCP tool will
 * reach the canvas through the same handle the human-facing UI uses.
 */
export function useBoard(): {
  setApi: (api: ExcalidrawImperativeAPI) => void;
  actions: BoardActions;
} {
  // Tool calls can arrive faster than React re-renders, so actions read the
  // API through this ref rather than through state.
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [ready, setReady] = useState(false);

  const setApi = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    setReady(true);
  }, []);

  return {
    setApi,
    actions: { ready }
  };
}
