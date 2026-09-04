import {
  CaptureUpdateAction,
  convertToExcalidrawElements
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useRef, useState } from "react";

export type CreatedNote = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type BoardActions = {
  ready: boolean;
  getElements: () => readonly NonDeletedExcalidrawElement[];
  addElements: (
    skeletons: ExcalidrawElementSkeleton[]
  ) => readonly NonDeletedExcalidrawElement[];
  createNote: (text: string, x?: number, y?: number) => CreatedNote;
};

const NOTE_SIZE = 180;
const NOTE_GAP = 20;
const NOTE_COLUMNS = 5;
const NOTE_FILL = "#fef3bd";

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

  // A tool can fire before Excalidraw hands over its API, so an empty board
  // and an absent canvas both answer with an empty list rather than throwing.
  const getElements = useCallback(
    () => apiRef.current?.getSceneElements() ?? [],
    []
  );

  const addElements = useCallback((skeletons: ExcalidrawElementSkeleton[]) => {
    const api = apiRef.current;
    // Unlike a read, silently doing nothing here would report success to the
    // agent while the board stayed empty, so a missing canvas throws.
    if (!api) {
      throw new Error("The canvas is not ready yet.");
    }

    const created = convertToExcalidrawElements(skeletons);
    // updateScene replaces the whole scene, so existing elements have to be
    // passed back alongside the new ones or the board is wiped.
    api.updateScene({
      elements: [...api.getSceneElements(), ...created],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY
    });

    return created;
  }, []);

  const createNote = useCallback(
    (text: string, x?: number, y?: number): CreatedNote => {
      // Placing notes in a grid keeps agent-authored batches readable; without
      // it every note lands at the same spot and buries the ones beneath.
      const placed = apiRef.current?.getSceneElements().length ?? 0;
      const step = NOTE_SIZE + NOTE_GAP;
      const position = {
        x: x ?? (placed % NOTE_COLUMNS) * step,
        y: y ?? Math.floor(placed / NOTE_COLUMNS) * step
      };

      // A label expands into a second, bound text element, so the container is
      // the first of the two returned and the one whose ID identifies the note.
      const [note] = addElements([
        {
          type: "rectangle",
          ...position,
          width: NOTE_SIZE,
          height: NOTE_SIZE,
          backgroundColor: NOTE_FILL,
          fillStyle: "solid",
          strokeColor: "transparent",
          label: { text, fontSize: 16, verticalAlign: "top" }
        }
      ]);

      // Scroll the note into view so a human watching sees what the agent did.
      apiRef.current?.scrollToContent(note, { fitToContent: false });

      return { id: note.id, text, ...position };
    },
    [addElements]
  );

  return {
    setApi,
    actions: { ready, getElements, addElements, createNote }
  };
}
