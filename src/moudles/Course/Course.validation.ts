import z from "zod";
import { StudyYear } from "@prisma/client";

export const createCourseSchema = {
  body: z.object({
    name: z.string().trim().min(3, "course name must be at least 3 characters"),
    courseCode: z.string().trim().toUpperCase(),
    creditHours: z.number().int().min(1).max(6),
    yearNumber: z.nativeEnum(StudyYear),
    departmentIds: z.array(z.string().uuid()).optional(),
    prerequisiteIds: z.array(z.string().uuid()).optional(),
  }),
};

export const updateCourseSchema = {
  body: z.object({
    name: z.string().trim().min(3).optional(),
    courseCode: z.string().trim().toUpperCase().optional(),
    creditHours: z.number().int().min(1).max(6).optional(),
    yearNumber: z.nativeEnum(StudyYear).optional(),
    departmentIds: z.array(z.string().uuid()).optional(),
    prerequisiteIds: z.array(z.string().uuid()).optional(),
  }),
};

export type createCourseSchemaType = z.infer<typeof createCourseSchema.body>;
export type updateCourseSchemaType = z.infer<typeof updateCourseSchema.body>;