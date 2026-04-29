import z from "zod";

export const enrollSchema = {
  body: z.object({
    courseId: z.string().uuid(),
  }),
};

export type enrollSchemaType = z.infer<typeof enrollSchema.body>;