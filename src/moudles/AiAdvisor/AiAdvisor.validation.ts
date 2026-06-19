import z from "zod";

export const gpaTargetSchema = {
  body: z.object({
    targetGpa: z.number().min(0.0, "GPA cannot be less than 0.0").max(4.0, "GPA cannot exceed 4.0"),
  }),
};

export type gpaTargetSchemaType = z.infer<typeof gpaTargetSchema.body>;
