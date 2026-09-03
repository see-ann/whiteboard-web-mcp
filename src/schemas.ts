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
          `Board ${axis} coordinate. Omit to place the note automatically in free space.`
        )
      )
  );

export const createNoteArgsSchema = z.object({
  text: noteTextSchema,
  x: coordinateSchema("x"),
  y: coordinateSchema("y")
});

export const listElementsArgsSchema = z.object({});

// Generate the JSON Schemas agents discover from the same contracts used to
// validate tool calls at runtime.
export const toolInputSchemas = {
  createNote: z.toJSONSchema(createNoteArgsSchema, {
    target: "draft-07",
    io: "input"
  }),
  listElements: z.toJSONSchema(listElementsArgsSchema, {
    target: "draft-07",
    io: "input"
  })
} as const;

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
