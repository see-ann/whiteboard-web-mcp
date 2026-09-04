import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const STORAGE_KEY = "agent-whiteboard.scene";

/**
 * Read the saved board, or null when there is nothing usable to restore.
 *
 * Storage can hold a scene written by an older build, and it is unavailable
 * outright in private windows and with site data blocked, so a failure here
 * yields an empty board rather than breaking the canvas.
 */
export function loadElements(): ExcalidrawElement[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as ExcalidrawElement[]) : null;
  } catch {
    return null;
  }
}

export function saveElements(elements: readonly ExcalidrawElement[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
  } catch {
    // A full or unavailable store should cost the user their history, not
    // their session.
  }
}

export function clearElements(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignored for the same reason as a failed write.
  }
}

export { STORAGE_KEY };
