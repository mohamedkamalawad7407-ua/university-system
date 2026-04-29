import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import { createCourseSchemaType, updateCourseSchemaType } from "./Course.validation";

const prisma = new PrismaClient();

class CourseService {
  // ============ CREATE ============
  createCourse = async (req: Request, res: Response, next: NextFunction) => {
    const {
      name,
      courseCode,
      creditHours,
      yearNumber,
      departmentIds,
      prerequisiteIds,
    }: createCourseSchemaType = req.body;

    const exists = await prisma.course.findUnique({ where: { courseCode } });
    if (exists) throw new AppError("course already exists", 409);

    if (departmentIds?.length) {
      const departments = await prisma.department.findMany({
        where: { id: { in: departmentIds } },
      });
      if (departments.length !== departmentIds.length) {
        throw new AppError("one or more departments not found", 404);
      }
    }

    // تحقق من الـ prerequisites لو موجودة
    if (prerequisiteIds?.length) {
      const prereqs = await prisma.course.findMany({
        where: { id: { in: prerequisiteIds } },
      });
      if (prereqs.length !== prerequisiteIds.length) {
        throw new AppError("one or more prerequisite courses not found", 404);
      }
    }

    const course = await prisma.course.create({
      data: {
        name,
        courseCode,
        creditHours,
        yearNumber,
        ...(departmentIds?.length && {
          departments: {
            connect: departmentIds.map((id) => ({ id })),
          },
        }),
        ...(prerequisiteIds?.length && {
          prerequisites: {
            connect: prerequisiteIds.map((id) => ({ id })),
          },
        }),
      },
      include: { departments: true, prerequisites: true },
    });

    return res.status(201).json({ message: "course created", course });
  };

  // ============ GET ALL ============
  getAllCourses = async (req: Request, res: Response, next: NextFunction) => {
    const courses = await prisma.course.findMany({
      include: { departments: true, prerequisites: true },
      orderBy: { yearNumber: "asc" },
    });
    return res.status(200).json({ courses });
  };

  // ============ GET ONE ============
  getCourse = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id : id as string },
      include: { departments: true, prerequisites: true },
    });
    if (!course) throw new AppError("course not found", 404);

    return res.status(200).json({ course });
  };

  // ============ UPDATE ============
  updateCourse = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const {
      name,
      courseCode,
      creditHours,
      yearNumber,
      departmentIds,
      prerequisiteIds,
    }: updateCourseSchemaType = req.body;

    const course = await prisma.course.findUnique({ where: { id :id as string } });
    if (!course) throw new AppError("course not found", 404);

    if (departmentIds) {
      const departments = await prisma.department.findMany({
        where: { id: { in: departmentIds } },
      });
      if (departments.length !== departmentIds.length) {
        throw new AppError("one or more departments not found", 404);
      }
    }

    if (prerequisiteIds) {
      const prereqs = await prisma.course.findMany({
        where: { id: { in: prerequisiteIds } },
      });
      if (prereqs.length !== prerequisiteIds.length) {
        throw new AppError("one or more prerequisite courses not found", 404);
      }
    }

    const updated = await prisma.course.update({
      where: { id : id as string },
      data: {
        ...(name && { name }),
        ...(courseCode && { courseCode }),
        ...(creditHours && { creditHours }),
        ...(yearNumber && { yearNumber }),
        ...(departmentIds && {
          departments: { set: departmentIds.map((id) => ({ id })) },
        }),
        ...(prerequisiteIds && {
          prerequisites: { set: prerequisiteIds.map((id) => ({ id })) },
        }),
      },
      include: { departments: true, prerequisites: true },
    });

    return res.status(200).json({ message: "course updated", course: updated });
  };

  // ============ DELETE ============
  deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const course = await prisma.course.findUnique({ where: { id : id as string } });
    if (!course) throw new AppError("course not found", 404);

    await prisma.course.delete({ where: { id : id as string } });
    return res.status(200).json({ message: "course deleted" });
  };
}

export default new CourseService();