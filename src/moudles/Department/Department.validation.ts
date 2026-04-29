import z from "zod";

export const createDepartmentSchema = {
  body: z.object({
    name: z.string().trim().min(2),
    maxStudents: z.number().int().min(1),
    minGpa: z.number().min(0).max(4),
  }),
};

export const updateDepartmentSchema = {
  body: z.object({
    name: z.string().trim().min(2).optional(),
    maxStudents: z.number().int().min(1).optional(),
    minGpa: z.number().min(0).max(4).optional(),
  }),
};

export const assignStudentSchema = {
  body: z.object({
    studentId: z.string().uuid(),
    departmentId: z.string().uuid(),
  }),
};

export type createDepartmentSchemaType = z.infer<typeof createDepartmentSchema.body>;
export type updateDepartmentSchemaType = z.infer<typeof updateDepartmentSchema.body>;
export type assignStudentSchemaType = z.infer<typeof assignStudentSchema.body>;