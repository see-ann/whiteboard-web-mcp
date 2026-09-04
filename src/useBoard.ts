import {
  CaptureUpdateAction,
  convertToExcalidrawElements
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useRef, useState } from "react";
import type { DiagramEdge, DiagramNode, ShapeKind } from "./schemas";

export type CreatedNote = {
  id: string;
  text: string;
  x: number;
  y: number;
};

export type CreatedShape = {
  id: string;
  shape: ShapeKind;
  text?: string;
  x: number;
  y: number;
};

export type CreatedDiagram = {
  nodes: Array<{ key: string; id: string; text: string }>;
  edgeCount: number;
};

export type BoardActions = {
  ready: boolean;
  getElements: () => readonly NonDeletedExcalidrawElement[];
  addElements: (
    skeletons: ExcalidrawElementSkeleton[]
  ) => readonly NonDeletedExcalidrawElement[];
  createNote: (text: string, x?: number, y?: number) => CreatedNote;
  createShape: (options: {
    shape: ShapeKind;
    text?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => CreatedShape;
  connectElements: (from: string, to: string, label?: string) => { id: string };
  createDiagram: (
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    direction: "horizontal" | "vertical"
  ) => CreatedDiagram;
};

const NOTE_SIZE = 180;
const NOTE_GAP = 20;
const NOTE_COLUMNS = 5;
const NOTE_FILL = "#fef3bd";
const NOTE_TEXT_COLOR = "#1e1e1e";

const SHAPE_WIDTH = 200;
const SHAPE_HEIGHT = 100;
const SHAPE_GAP = 120;
const SHAPE_STROKE = "#1e1e1e";

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
          // A label inherits its container's strokeColor, so the borderless
          // note would otherwise render its text transparent and invisible.
          label: {
            text,
            fontSize: 16,
            verticalAlign: "top",
            strokeColor: NOTE_TEXT_COLOR
          }
        }
      ]);

      // Scroll the note into view so a human watching sees what the agent did.
      apiRef.current?.scrollToContent(note, { fitToContent: false });

      return { id: note.id, text, ...position };
    },
    [addElements]
  );

  const createShape = useCallback(
    ({
      shape,
      text,
      x,
      y,
      width = SHAPE_WIDTH,
      height = SHAPE_HEIGHT
    }: {
      shape: ShapeKind;
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }): CreatedShape => {
      const placed = apiRef.current?.getSceneElements().length ?? 0;
      const position = {
        x: x ?? (placed % NOTE_COLUMNS) * (SHAPE_WIDTH + NOTE_GAP),
        y: y ?? Math.floor(placed / NOTE_COLUMNS) * (SHAPE_HEIGHT + NOTE_GAP)
      };

      const [element] = addElements([
        {
          type: shape,
          ...position,
          width,
          height,
          strokeColor: SHAPE_STROKE,
          ...(text ? { label: { text, fontSize: 16 } } : {})
        }
      ]);

      apiRef.current?.scrollToContent(element, { fitToContent: false });

      return { id: element.id, shape, text, ...position };
    },
    [addElements]
  );

  const connectElements = useCallback(
    (from: string, to: string, label?: string) => {
      const elements = apiRef.current?.getSceneElements() ?? [];
      const source = elements.find((element) => element.id === from);
      const target = elements.find((element) => element.id === to);
      if (!source || !target) {
        throw new Error(
          `Could not find ${!source ? `element "${from}"` : `element "${to}"`}.`
        );
      }

      // Span the real gap between the two shapes. Leaving from the source's
      // right edge with no width assumed the target sat directly beside it, so
      // connecting anything above, below or behind drew a stub.
      const sourceCentre = {
        x: source.x + source.width / 2,
        y: source.y + source.height / 2
      };
      const targetCentre = {
        x: target.x + target.width / 2,
        y: target.y + target.height / 2
      };

      // start/end bind the arrow to the shapes themselves, so dragging either
      // one keeps the connection rather than stranding a loose line.
      const [arrow] = addElements([
        {
          type: "arrow",
          x: sourceCentre.x,
          y: sourceCentre.y,
          width: targetCentre.x - sourceCentre.x,
          height: targetCentre.y - sourceCentre.y,
          start: { id: from },
          end: { id: to },
          strokeColor: SHAPE_STROKE,
          ...(label ? { label: { text: label, fontSize: 14 } } : {})
        }
      ]);

      return { id: arrow.id };
    },
    [addElements]
  );

  const createDiagram = useCallback(
    (
      nodes: DiagramNode[],
      edges: DiagramEdge[],
      direction: "horizontal" | "vertical"
    ): CreatedDiagram => {
      const horizontal = direction === "horizontal";

      // Start below everything already drawn. A fixed offset stacked every
      // diagram after the first onto the same rows, overlapping their labels.
      const existing = apiRef.current?.getSceneElements() ?? [];
      const lowest = existing.reduce(
        (bottom, element) => Math.max(bottom, element.y + element.height),
        Number.NEGATIVE_INFINITY
      );
      const origin = {
        x: 0,
        y: existing.length > 0 ? lowest + SHAPE_GAP : 0
      };

      // Excalidraw accepts caller-supplied IDs, so nodes and the arrows between
      // them can be built in one pass instead of creating shapes, reading back
      // their generated IDs, and connecting them in a second round trip.
      const idByKey = new Map(
        nodes.map((node) => [node.key, `node-${crypto.randomUUID()}`])
      );

      // Excalidraw clips a bound label rather than growing its container, so a
      // fixed box turned any real sentence into "ent discovers the too". Size
      // every node to the longest label so the row stays aligned.
      const longest = nodes.reduce(
        (chars, node) => Math.max(chars, node.text.length),
        0
      );
      const fontSize = longest > 60 ? 12 : longest > 30 ? 14 : 16;
      const nodeWidth = Math.min(
        Math.max(SHAPE_WIDTH, longest * fontSize * 0.42),
        420
      );
      // Ellipses inscribe their text, so they need more room than a rectangle
      // to hold the same words.
      const nodeHeight = Math.max(
        SHAPE_HEIGHT,
        Math.ceil((longest * fontSize * 0.62) / nodeWidth) * fontSize * 2.4 + 48
      );
      const stepX = nodeWidth + SHAPE_GAP;
      const stepY = nodeHeight + SHAPE_GAP;

      const nodeSkeletons: ExcalidrawElementSkeleton[] = nodes.map(
        (node, index) => ({
          type: node.shape ?? "rectangle",
          id: idByKey.get(node.key),
          x: origin.x + (horizontal ? index * stepX : 0),
          y: origin.y + (horizontal ? 0 : index * stepY),
          width: nodeWidth,
          height: nodeHeight,
          strokeColor: SHAPE_STROKE,
          label: { text: node.text, fontSize }
        })
      );

      const indexByKey = new Map(nodes.map((node, index) => [node.key, index]));

      const edgeSkeletons: ExcalidrawElementSkeleton[] = edges.flatMap(
        (edge) => {
          const from = idByKey.get(edge.from);
          const to = idByKey.get(edge.to);
          const fromIndex = indexByKey.get(edge.from);
          const toIndex = indexByKey.get(edge.to);
          // An edge naming a node that does not exist is dropped rather than
          // failing the whole diagram, so one typo cannot lose every shape.
          if (
            !from ||
            !to ||
            fromIndex === undefined ||
            toIndex === undefined
          ) {
            return [];
          }

          // Every arrow needs its own start point and a real span. Sharing one
          // origin collapses them into zero-length lines stacked on each other,
          // and only the first is drawn.
          // A node cannot flow into itself, and Excalidraw cannot bind an arrow
          // to one element twice, so a self-loop is dropped like a bad key.
          if (fromIndex === toIndex) {
            return [];
          }

          const gap = horizontal ? stepX : stepY;
          const forward = toIndex > fromIndex;
          const shapeSize = horizontal ? nodeWidth : nodeHeight;
          // Signed, so a backwards edge spans right-to-left rather than being
          // drawn forwards from the wrong node and pointing off the diagram.
          const span = (toIndex - fromIndex) * gap - (forward ? shapeSize : 0);
          // A forward arrow leaves the source's far edge; a backward one leaves
          // its near edge and travels back.
          const offset = fromIndex * gap + (forward ? shapeSize : 0);
          const crossAxis = horizontal ? nodeHeight : nodeWidth;
          // Route a backwards edge outside the row. Drawn on the centre line it
          // runs straight through every shape between its two endpoints.
          const detour = forward ? crossAxis / 2 : crossAxis + SHAPE_GAP;

          return [
            {
              type: "arrow" as const,
              x: origin.x + (horizontal ? offset : detour),
              y: origin.y + (horizontal ? detour : offset),
              width: horizontal ? span : 0,
              height: horizontal ? 0 : span,
              start: { id: from },
              end: { id: to },
              strokeColor: SHAPE_STROKE,
              ...(edge.label
                ? { label: { text: edge.label, fontSize: 14 } }
                : {})
            }
          ];
        }
      );

      const created = addElements([...nodeSkeletons, ...edgeSkeletons]);
      apiRef.current?.scrollToContent(apiRef.current.getSceneElements(), {
        fitToContent: true
      });

      // Excalidraw reassigns IDs, so the requested ones would be dead
      // references. Report the IDs it actually issued, matching containers back
      // to their nodes by position: labels are appended after the shapes.
      const containers = created.filter(
        (element) => !("containerId" in element && element.containerId)
      );

      return {
        nodes: nodes.map((node, index) => ({
          key: node.key,
          id: containers[index]?.id ?? "",
          text: node.text
        })),
        edgeCount: edgeSkeletons.length
      };
    },
    [addElements]
  );

  return {
    setApi,
    actions: {
      ready,
      getElements,
      addElements,
      createNote,
      createShape,
      connectElements,
      createDiagram
    }
  };
}
