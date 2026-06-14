import z from "zod";
import { StudyYear } from "@prisma/client";

export const signinStudentSchema = {
  body: z.object({
    studentCode: z.string().trim(),
    nationalId: z.string().trim(),
  }),
};

export const addStudentSchema = {
  body: z.object({
    studentCode: z.string().trim(),
    nationalId: z.string().trim().min(14, "National ID must be 14 digits").max(14, "National ID must be 14 digits").regex(/^[0-9]+$/),
    fullName: z.string().trim(),
    currentYear: z.nativeEnum(StudyYear),
    departmentId: z.string().uuid().optional(),
  }),
};

export type signinStudentSchemaType = z.infer<typeof signinStudentSchema.body>;
export type addStudentSchemaType = z.infer<typeof addStudentSchema.body>;