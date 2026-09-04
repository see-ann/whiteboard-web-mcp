import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { type PointerEvent, useCallback, useRef } from "react";

export type ViewportBounds = {
  /** Board x of the leftmost visible point. */
  left: number;
  /** Board width currently on screen. */
  width: number;
  /** Board x of the leftmost element. */
  contentLeft: number;
  /** Board x of the rightmost element edge. */
  contentRight: number;
};

const TRACK_PADDING = 200;

/**
 * A draggable horizontal scrollbar for the canvas.
 *
 * Excalidraw pans with shift+wheel and the hand tool but shows no scrollbar,
 * so on a wide diagram there is nothing telling a viewer that more board
 * exists off to the side, and nothing to drag.
 */
export function HorizontalScrollbar({
  api,
  bounds
}: {
  api: ExcalidrawImperativeAPI | null;
  bounds: ViewportBounds | null;
}) {
  const dragRef = useRef<{ pointerX: number; scrollX: number } | null>(null);

  // The track spans the content plus a screen of slack at each end, so the
  // thumb never fills the bar completely and panning past the edge still reads.
  const trackLeft =
    bounds === null
      ? 0
      : Math.min(bounds.contentLeft, bounds.left) - TRACK_PADDING;
  const trackRight =
    bounds === null
      ? 0
      : Math.max(bounds.contentRight, bounds.left + bounds.width) +
        TRACK_PADDING;
  const trackWidth = trackRight - trackLeft;

  const scrollToBoardX = useCallback(
    (boardX: number) => {
      if (!api || !bounds) {
        return;
      }
      // scrollX is the negated board offset: panning right lowers it.
      api.updateScene({ appState: { scrollX: -boardX } });
    },
    [api, bounds]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!bounds) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { pointerX: event.clientX, scrollX: bounds.left };
    },
    [bounds]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || !bounds || trackWidth <= 0) {
        return;
      }
      const barWidth = event.currentTarget.clientWidth;
      const boardPerPixel = trackWidth / barWidth;
      const moved = (event.clientX - drag.pointerX) * boardPerPixel;
      scrollToBoardX(drag.scrollX + moved);
    },
    [bounds, scrollToBoardX, trackWidth]
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }, []);

  if (!bounds || trackWidth <= 0) {
    return null;
  }

  const thumbLeft = ((bounds.left - trackLeft) / trackWidth) * 100;
  const thumbWidth = Math.max((bounds.width / trackWidth) * 100, 6);

  return (
    <output
      className="absolute inset-x-0 bottom-0 h-4 select-none px-16"
      aria-label="Scroll the board horizontally"
    >
      <div className="relative h-1.5 rounded-full bg-kumo-line/60">
        <div
          className="absolute top-0 h-1.5 cursor-grab rounded-full bg-kumo-inactive transition-colors hover:bg-kumo-subtle active:cursor-grabbing"
          style={{
            left: `${Math.max(0, Math.min(thumbLeft, 100 - thumbWidth))}%`,
            width: `${thumbWidth}%`
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
    </output>
  );
}
