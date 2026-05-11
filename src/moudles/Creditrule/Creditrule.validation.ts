import z from "zod";

export const createCreditRuleSchema = {
  body: z
    .object({
      minGpa: z.number().min(0).max(4),
      maxGpa: z.number().min(0).max(4).optional(),
      maxCredits: z.number().int().min(1).max(30),
      isForNewStudents: z.boolean().optional(),
    })
    .refine((data) => data.isForNewStudents || (!data.maxGpa || data.maxGpa > data.minGpa), {
      message: "maxGpa must be greater than minGpa unless it is for new students",
    }),
};

export const updateCreditRuleSchema = {
  body: z.object({
    minGpa: z.number().min(0).max(4).optional(),
    maxGpa: z.number().min(0).max(4).optional(),
    maxCredits: z.number().int().min(1).max(30).optional(),
    isForNewStudents: z.boolean().optional(),
  }),
};

export type createCreditRuleSchemaType = z.infer<typeof createCreditRuleSchema.body>;
export type updateCreditRuleSchemaType = z.infer<typeof updateCreditRuleSchema.body>;