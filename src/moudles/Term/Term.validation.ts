import z from "zod";
import { Semester, StudyYear } from "@prisma/client";

export const createTermSchema = {
  body: z.object({
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}\/\d{4}$/, "format must be YYYY/YYYY like 2024/2025"),
    semester: z.nativeEnum(Semester),
    // نافذة تسجيل لكل سنة دراسية
    registrationWindows: z
      .array(
        z.object({
          year: z.nativeEnum(StudyYear),
          startDate: z.string().datetime("invalid date format, use ISO 8601"),
          endDate: z.string().datetime("invalid date format, use ISO 8601"),
        }).refine((d) => new Date(d.endDate) > new Date(d.startDate), {
          message: "endDate must be after startDate",
        })
      )
      .min(1, "at least one registration window required")
      .max(4, "max 4 windows (one per year)")
      .refine(
        (windows) => {
          const years = windows.map((w) => w.year);
          return new Set(years).size === years.length;
        },
        { message: "duplicate year in registration windows" }
      ),
  }),
};

export const updateRegistrationWindowSchema = {
  body: z.object({
    year: z.nativeEnum(StudyYear),
    startDate: z.string().datetime("invalid date format, use ISO 8601"),
    endDate: z.string().datetime("invalid date format, use ISO 8601"),
  }).refine((d) => new Date(d.endDate) > new Date(d.startDate), {
    message: "endDate must be after startDate",
  }),
};

export type createTermSchemaType = z.infer<typeof createTermSchema.body>;
export type updateRegistrationWindowSchemaType = z.infer<typeof updateRegistrationWindowSchema.body>;