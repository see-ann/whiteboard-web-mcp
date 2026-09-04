import { useEffect, useState } from "react";
import {
  connectElementsArgsSchema,
  createDiagramArgsSchema,
  createNoteArgsSchema,
  createShapeArgsSchema,
  parseArgs,
  toolInputSchemas
} from "./schemas";
import type { BoardActions } from "./useBoard";

export type WebMCPToolsState = {
  supported: boolean;
  registered: boolean;
  toolNames: string[];
  error: Error | null;
};

export function useWebMCPTools(
  actions: BoardActions,
  elementCount: number
): WebMCPToolsState {
  const {
    connectElements,
    createDiagram,
    createNote,
    createShape,
    getElements
  } = actions;
  const [state, setState] = useState<WebMCPToolsState>({
    supported: false,
    registered: false,
    toolNames: [],
    error: null
  });

  // Registration depends on how full the board is, so tools that need existing
  // elements appear only once there are some. Bucketing keeps every added
  // element from tearing down and re-registering the whole tool set.
  const hasElements = elementCount > 0;
  const canConnect = elementCount > 1;

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setState({
        supported: false,
        registered: false,
        toolNames: [],
        error: null
      });
      return;
    }

    const registeredModelContext = modelContext;
    const controller = new AbortController();
    setState({
      supported: true,
      registered: false,
      toolNames: [],
      error: null
    });

    const tools: WebMCPTool[] = [
      {
        name: "create_note",
        title: "Create note",
        description:
          "Add a sticky note to the whiteboard. Omit x and y to place it automatically in free space.",
        inputSchema: toolInputSchemas.createNote,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(args) {
          const { text, x, y } = parseArgs(createNoteArgsSchema, args);
          const note = createNote(text, x, y);
          return { message: "Note created.", note };
        }
      },
      {
        name: "create_shape",
        title: "Create shape",
        description:
          "Draw a labelled rectangle, ellipse or diamond. Use this for diagram boxes rather than sticky notes. Omit x and y to place it automatically.",
        inputSchema: toolInputSchemas.createShape,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(args) {
          const options = parseArgs(createShapeArgsSchema, args);
          const shape = createShape(options);
          return { message: "Shape created.", shape };
        }
      },
      {
        name: "create_diagram",
        title: "Create diagram",
        description:
          "Draw a whole diagram at once: several labelled boxes plus the arrows between them, laid out and connected in a single call. Each node takes a short key that edges reference. Prefer this over repeated create_shape and connect_elements calls.",
        inputSchema: toolInputSchemas.createDiagram,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(args, { signal }) {
          const {
            nodes,
            edges = [],
            direction = "horizontal"
          } = parseArgs(createDiagramArgsSchema, args);
          // A large diagram is one synchronous write, so the only useful place
          // to honour cancellation is before it starts.
          signal.throwIfAborted();
          const diagram = createDiagram(nodes, edges, direction);
          return { message: "Diagram created.", ...diagram };
        }
      }
    ];

    if (hasElements) {
      tools.push({
        name: "list_elements",
        title: "List elements",
        description:
          "List every element on the whiteboard with its ID, type, position and text.",
        inputSchema: toolInputSchemas.listElements,
        // Element text is written by whoever shares the board, so it reaches
        // the agent as untrusted data rather than as instructions.
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        async execute() {
          const all = getElements();

          // A shape's label is a separate text element bound to it. Listing
          // both would show the agent two entries for one visible note, so the
          // text is folded into its container and the child is dropped.
          const labels = new Map(
            all
              .filter(
                (element) => "containerId" in element && element.containerId
              )
              .map((element) => [
                (element as { containerId: string }).containerId,
                (element as { text: string }).text
              ])
          );

          const elements = all
            .filter(
              (element) => !("containerId" in element && element.containerId)
            )
            .map((element) => ({
              id: element.id,
              type: element.type,
              x: Math.round(element.x),
              y: Math.round(element.y),
              text:
                labels.get(element.id) ??
                ("text" in element ? element.text : undefined)
            }));

          return { count: elements.length, elements };
        }
      });
    }

    if (canConnect) {
      tools.push({
        name: "connect_elements",
        title: "Connect elements",
        description:
          "Draw an arrow between two existing elements, bound so it follows them when either is moved. Use IDs from list_elements or a create tool.",
        inputSchema: toolInputSchemas.connectElements,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(args) {
          const { from, to, label } = parseArgs(
            connectElementsArgsSchema,
            args
          );
          const arrow = connectElements(from, to, label);
          return { message: "Elements connected.", arrow };
        }
      });
    }

    async function registerTools() {
      try {
        await Promise.all(
          tools.map((tool) =>
            registeredModelContext.registerTool(tool, {
              signal: controller.signal
            })
          )
        );
        if (!controller.signal.aborted) {
          setState({
            supported: true,
            registered: true,
            toolNames: tools.map((tool) => tool.name),
            error: null
          });
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setState({
            supported: true,
            registered: false,
            toolNames: [],
            error:
              caught instanceof Error
                ? caught
                : new Error("WebMCP tool registration failed.")
          });
        }
      }
    }

    void registerTools();

    // Aborting unregisters every tool when the board's tool set changes or the
    // component unmounts.
    return () => controller.abort();
  }, [
    canConnect,
    connectElements,
    createDiagram,
    createNote,
    createShape,
    getElements,
    hasElements
  ]);

  return state;
}
