import z from "zod";

const letterGradeSchema = z.string()
  .trim()
  .toUpperCase()
  .regex(/^[A-F][+-]?$/, "Invalid Grade format (e.g. A+, B, C-)");

export const createGradeScaleSchema = {
  body: z.object({
    letterGrade: letterGradeSchema,
    minScore: z.number().min(0).max(100),
    maxScore: z.number().min(0).max(100),
    gpaPoints: z.number().min(0).max(4),
  }).refine((d) => d.maxScore > d.minScore, {
    message: "maxScore must be greater than minScore",
  }),
};

export const updateGradeScaleSchema = {
  body: z.object({
    letterGrade: letterGradeSchema.optional(),
    minScore: z.number().min(0).max(100).optional(),
    maxScore: z.number().min(0).max(100).optional(),
    gpaPoints: z.number().min(0).max(4).optional(),
  }),
};


export const bulkCreateGradeScaleSchema = {
  body: z.object({
    scales: z
      .array(
        z.object({
          letterGrade: letterGradeSchema,
          minScore: z.number().min(0).max(100),
          maxScore: z.number().min(0).max(100),
          gpaPoints: z.number().min(0).max(4),
        }).refine((d) => d.maxScore > d.minScore, {
          message: "maxScore must be greater than minScore",
        })
      )
      .min(1),
  }),
};

export type createGradeScaleSchemaType = z.infer<typeof createGradeScaleSchema.body>;
export type updateGradeScaleSchemaType = z.infer<typeof updateGradeScaleSchema.body>;
export type bulkCreateGradeScaleSchemaType = z.infer<typeof bulkCreateGradeScaleSchema.body>;