import * as z from "zod/mini";

z.config(z.locales.en());

export const NOTE_TEXT_MAX_LENGTH = 500;

export const noteTextSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(1, "Note text is required."),
    z.maxLength(
      NOTE_TEXT_MAX_LENGTH,
      `Note text must be ${NOTE_TEXT_MAX_LENGTH} characters or fewer.`
    ),
    z.describe("The text to write on the note.")
  );

const coordinateSchema = (axis: "x" | "y") =>
  z.optional(
    z
      .number()
      .check(
        z.describe(
          `Board ${axis} coordinate. Omit to place the element automatically in free space.`
        )
      )
  );

export const shapeKindSchema = z
  .enum(["rectangle", "ellipse", "diamond"])
  .check(
    z.describe(
      "Shape outline. Rectangles suit steps and services, diamonds suit decisions, ellipses suit start and end points."
    )
  );

export const elementIdSchema = z
  .string()
  .check(
    z.minLength(1, "An element ID is required."),
    z.describe("An element ID returned by list_elements or a create tool.")
  );

export const createNoteArgsSchema = z.object({
  text: noteTextSchema,
  x: coordinateSchema("x"),
  y: coordinateSchema("y")
});

export const createShapeArgsSchema = z.object({
  shape: shapeKindSchema,
  text: z.optional(noteTextSchema),
  x: coordinateSchema("x"),
  y: coordinateSchema("y"),
  width: z.optional(
    z.number().check(z.describe("Width in board units. Defaults to 200."))
  ),
  height: z.optional(
    z.number().check(z.describe("Height in board units. Defaults to 100."))
  )
});

export const connectElementsArgsSchema = z.object({
  from: elementIdSchema,
  to: elementIdSchema,
  label: z.optional(
    z.string().check(z.describe("Optional text to write along the arrow."))
  )
});

// Diagram nodes carry a caller-chosen key so edges can reference them in the
// same call, before Excalidraw has assigned real element IDs.
const diagramNodeSchema = z.object({
  key: z
    .string()
    .check(
      z.minLength(1),
      z.describe("A short name for this node, used by edges in this same call.")
    ),
  text: noteTextSchema,
  shape: z.optional(shapeKindSchema)
});

const diagramEdgeSchema = z.object({
  from: z.string().check(z.describe("The key of the source node.")),
  to: z.string().check(z.describe("The key of the target node.")),
  label: z.optional(
    z.string().check(z.describe("Optional text to write along the arrow."))
  )
});

export const createDiagramArgsSchema = z.object({
  nodes: z
    .array(diagramNodeSchema)
    .check(z.describe("The boxes to draw, in reading order.")),
  edges: z.optional(
    z
      .array(diagramEdgeSchema)
      .check(z.describe("Arrows between nodes, referenced by their keys."))
  ),
  direction: z.optional(
    z
      .enum(["horizontal", "vertical"])
      .check(z.describe("Flow direction. Defaults to horizontal."))
  )
});

export const listElementsArgsSchema = z.object({});

// Generate the JSON Schemas agents discover from the same contracts used to
// validate tool calls at runtime.
export const toolInputSchemas = {
  createNote: z.toJSONSchema(createNoteArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  createShape: z.toJSONSchema(createShapeArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  connectElements: z.toJSONSchema(connectElementsArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  createDiagram: z.toJSONSchema(createDiagramArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  listElements: z.toJSONSchema(listElementsArgsSchema, {
    target: "draft-07",
    io: "input"
  })
} as const;

export type ShapeKind = z.infer<typeof shapeKindSchema>;
export type DiagramNode = z.infer<typeof diagramNodeSchema>;
export type DiagramEdge = z.infer<typeof diagramEdgeSchema>;

export function parseArgs<Schema extends z.ZodMiniType>(
  schema: Schema,
  input: unknown
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(z.prettifyError(result.error));
  }
  return result.data;
}
