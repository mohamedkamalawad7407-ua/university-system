import z from "zod";
import { StudyYear } from "@prisma/client";

export const createPromotionRuleSchema = {
  body: z.object({
    fromYear: z.nativeEnum(StudyYear),
    minCredits: z.number().int().min(1, "minCredits must be at least 1"),
  }),
};

export const updatePromotionRuleSchema = {
  body: z.object({
    minCredits: z.number().int().min(1, "minCredits must be at least 1"),
  }),
};

export type createPromotionRuleSchemaType = z.infer<typeof createPromotionRuleSchema.body>;
export type updatePromotionRuleSchemaType = z.infer<typeof updatePromotionRuleSchema.body>;
