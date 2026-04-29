import z from "zod";

export const addGradeSchema = {
  body: z.object({
    enrollmentId: z.string().uuid(),
    score: z.number().min(0).max(100),
  }),
};

export const updateGradeSchema = {
  body: z.object({
    score: z.number().min(0).max(100),
  }),
};

export type addGradeSchemaType = z.infer<typeof addGradeSchema.body>;
export type updateGradeSchemaType = z.infer<typeof updateGradeSchema.body>;