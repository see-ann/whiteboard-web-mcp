import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

const STORAGE_KEY = "agent-whiteboard.scene";

/** The slice of Excalidraw's app state worth carrying across a reload. */
export type SavedViewport = Pick<AppState, "scrollX" | "scrollY" | "zoom">;

export type SavedScene = {
  elements: ExcalidrawElement[];
  viewport?: SavedViewport;
};

function isViewport(value: unknown): value is SavedViewport {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<SavedViewport>;
  return (
    typeof candidate.scrollX === "number" &&
    typeof candidate.scrollY === "number" &&
    typeof candidate.zoom?.value === "number"
  );
}

/**
 * Read the saved board, or null when there is nothing usable to restore.
 *
 * Storage can hold a scene written by an older build, and it is unavailable
 * outright in private windows and with site data blocked, so a failure here
 * yields an empty board rather than breaking the canvas.
 */
export function loadScene(): SavedScene | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed: unknown = JSON.parse(stored);

    // Builds before the viewport was saved wrote a bare array. Reading those
    // as elements keeps an existing board through the upgrade.
    if (Array.isArray(parsed)) {
      return { elements: parsed as ExcalidrawElement[] };
    }

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const scene = parsed as Partial<SavedScene>;
    if (!Array.isArray(scene.elements)) {
      return null;
    }

    return {
      elements: scene.elements,
      viewport: isViewport(scene.viewport) ? scene.viewport : undefined
    };
  } catch {
    return null;
  }
}

export function saveScene(
  elements: readonly ExcalidrawElement[],
  viewport: SavedViewport
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ elements, viewport }));
  } catch {
    // A full or unavailable store should cost the user their history, not
    // their session.
  }
}

export function clearScene(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored for the same reason as a failed write.
  }
}

export { STORAGE_KEY };
