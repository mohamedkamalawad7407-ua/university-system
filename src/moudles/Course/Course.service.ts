import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import { createCourseSchemaType, updateCourseSchemaType } from "./Course.validation";
import prisma from "../../utils/prisma";


class CourseService {

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


  getAllCourses = async (req: Request, res: Response, next: NextFunction) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { search, departmentId, yearNumber, creditHours } = req.query;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { courseCode: { contains: search as string, mode: "insensitive" } },
        { yearNumber: { contains: search as string, mode: "insensitive" } }
      ];
    }

    if (departmentId) {
      whereClause.departments = {
        some: { id: departmentId as string },
      };
    }

    // Year Number filter (StudyYear enum)
    if (yearNumber) {
      whereClause.yearNumber = yearNumber as any;
    }

    // Credit Hours filter
    if (creditHours) {
      whereClause.creditHours = Number(creditHours);
    }

    // Run count and findMany concurrently
    const [courses, totalCount] = await Promise.all([
      prisma.course.findMany({
        where: whereClause,
        include: { departments: true, prerequisites: true },
        orderBy: { yearNumber: "asc" },
        skip,
        take: limit,
      }),
      prisma.course.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json({
      meta: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
      },
      courses,
    });
  };


  getCourse = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id: id as string },
      include: { departments: true, prerequisites: true },
    });
    if (!course) throw new AppError("course not found", 404);

    return res.status(200).json({ course });
  };


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

    const course = await prisma.course.findUnique({ where: { id: id as string } });
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
      where: { id: id as string },
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


  deleteCourse = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const course = await prisma.course.findUnique({ where: { id: id as string } });
    if (!course) throw new AppError("course not found", 404);

    await prisma.course.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "course deleted" });
  };
}

export default new CourseService();