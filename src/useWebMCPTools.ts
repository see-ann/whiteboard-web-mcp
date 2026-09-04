import { useEffect, useState } from "react";
import { createNoteArgsSchema, parseArgs, toolInputSchemas } from "./schemas";
import type { BoardActions } from "./useBoard";

export type WebMCPToolsState = {
  supported: boolean;
  registered: boolean;
  error: Error | null;
};

export function useWebMCPTools(actions: BoardActions): WebMCPToolsState {
  const { createNote, getElements } = actions;
  const [state, setState] = useState<WebMCPToolsState>({
    supported: false,
    registered: false,
    error: null
  });

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      setState({ supported: false, registered: false, error: null });
      return;
    }

    const registeredModelContext = modelContext;
    const controller = new AbortController();
    setState({ supported: true, registered: false, error: null });

    const tools: WebMCPTool[] = [
      {
        name: "create_note",
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
        name: "list_elements",
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
      }
    ];

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
          setState({ supported: true, registered: true, error: null });
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setState({
            supported: true,
            registered: false,
            error:
              caught instanceof Error
                ? caught
                : new Error("WebMCP tool registration failed.")
          });
        }
      }
    }

    void registerTools();

    // Aborting unregisters every tool when the component unmounts.
    return () => controller.abort();
  }, [createNote, getElements]);

  return state;
}
