import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import { createTermSchemaType } from "./Term.validation";
import { updateRegistrationWindowSchemaType } from "./Term.validation";



const prisma = new PrismaClient();

class TermService {

  createTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { academicYear, semester, registrationWindows }: createTermSchemaType = req.body;


    const exists = await prisma.term.findUnique({
      where: { academicYear_semester: { academicYear, semester } },
    });
    if (exists) throw new AppError("term already exists", 409);


    for (const w of registrationWindows) {
      if (new Date(w.endDate) <= new Date(w.startDate)) {
        throw new AppError(`window for ${w.year}: endDate must be after startDate`, 400);
      }
    }


    const term = await prisma.$transaction(async (tx) => {
      const newTerm = await tx.term.create({
        data: {
          academicYear,
          semester,
          isActive: false,
        },
      });

      await tx.registrationWindow.createMany({
        data: registrationWindows.map((w: any) => ({
          termId: newTerm.id,
          year: w.year,
          startDate: new Date(w.startDate),
          endDate: new Date(w.endDate),
        })),
      });

      return tx.term.findUnique({
        where: { id: newTerm.id },
        include: {
          registrationWindows: {
            orderBy: { year: "asc" },
          },
        },
      });
    });

    return res.status(201).json({ message: "term created", term });
  };


  getAllTerms = async (req: Request, res: Response, next: NextFunction) => {
    const terms = await prisma.term.findMany({
      include: {
        registrationWindows: { orderBy: { year: "asc" } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { academicYear: "desc" },
    });
    return res.status(200).json({ terms });
  };


  getTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const term = await prisma.term.findUnique({
      where: { id: id as string },
      include: {
        registrationWindows: { orderBy: { year: "asc" } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!term) throw new AppError("term not found", 404);


    const now = new Date();
    const windowsStatus = term.registrationWindows.map((w: any) => ({
      year: w.year,
      startDate: w.startDate,
      endDate: w.endDate,
      status:
        now < w.startDate
          ? "upcoming"
          : now > w.endDate
          ? "closed"
          : "open",
    }));

    return res.status(200).json({ term: { ...term, windowsStatus } });
  };


  openTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const term = await prisma.term.findUnique({
      where: { id: id as string },
      include: { registrationWindows: true },
    });
    if (!term) throw new AppError("term not found", 404);
    if (term.isActive) throw new AppError("term is already open", 400);


    if (term.registrationWindows.length === 0) {
      throw new AppError("cannot open term without registration windows", 400);
    }


    const activeTerm = await prisma.term.findFirst({ where: { isActive: true } });
    if (activeTerm) {
      throw new AppError(
        `close term ${activeTerm.academicYear} - ${activeTerm.semester} first`,
        400
      );
    }

    const updated = await prisma.term.update({
      where: { id: id as string },
      data: { isActive: true },
      include: { registrationWindows: { orderBy: { year: "asc" } } },
    });

    return res.status(200).json({ message: "term opened successfully", term: updated });
  };


  closeTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const term = await prisma.term.findUnique({ where: { id: id as string } });
    if (!term) throw new AppError("term not found", 404);
    if (!term.isActive) throw new AppError("term is already closed", 400);

    const updated = await prisma.term.update({
      where: { id: id as string },
      data: { isActive: false },
    });

    return res.status(200).json({ message: "term closed successfully", term: updated });
  };


  updateRegistrationWindow = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;
    const { year, startDate, endDate }: updateRegistrationWindowSchemaType = req.body;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);

    const window = await prisma.registrationWindow.findUnique({
      where: { termId_year: { termId: termId as string, year } },
    });
    if (!window) throw new AppError(`no registration window found for ${year}`, 404);

    const updated = await prisma.registrationWindow.update({
      where: { termId_year: { termId: termId as string, year } },
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return res.status(200).json({ message: "registration window updated", window: updated });
  };


  addRegistrationWindow = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;
    const { year, startDate, endDate }: updateRegistrationWindowSchemaType = req.body;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);

    const exists = await prisma.registrationWindow.findUnique({
      where: { termId_year: { termId: termId as string, year } },
    });
    if (exists) throw new AppError(`window for ${year} already exists`, 409);

    const window = await prisma.registrationWindow.create({
      data: {
        termId: termId as string,
        year,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return res.status(201).json({ message: "registration window added", window });
  };


  deleteTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const term = await prisma.term.findUnique({ where: { id: id as string } });
    if (!term) throw new AppError("term not found", 404);
    if (term.isActive) throw new AppError("cannot delete an active term", 400);

    await prisma.term.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "term deleted" });
  };


  getActiveTerm = async (req: Request, res: Response, next: NextFunction) => {
    const activeTerm = await prisma.term.findFirst({
      where: { isActive: true },
      include: {
        registrationWindows: { orderBy: { year: "asc" } },
      },
    });

    if (!activeTerm) {
      return res.status(200).json({ message: "no active term", term: null });
    }

    const now = new Date();
    const windowsStatus = activeTerm.registrationWindows.map((w) => ({
      year: w.year,
      startDate: w.startDate,
      endDate: w.endDate,
      status:
        now < w.startDate
          ? "upcoming"
          : now > w.endDate
          ? "closed"
          : "open",
    }));

    return res.status(200).json({
      term: {
        ...activeTerm,
        windowsStatus,
      },
    });
  };


  addCoursesToTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;
    const { courseIds }: { courseIds: string[] } = req.body;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);


    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
    });
    if (courses.length !== courseIds.length) {
      const foundIds = courses.map((c) => c.id);
      const missing = courseIds.filter((id) => !foundIds.includes(id));
      throw new AppError(`courses not found: ${missing.join(", ")}`, 404);
    }


    const existing = await prisma.termCourse.findMany({
      where: { termId: termId as string, courseId: { in: courseIds } },
    });
    if (existing.length > 0) {
      const existingIds = existing.map((e) => e.courseId);
      throw new AppError(
        `courses already added to this term: ${existingIds.join(", ")}`,
        409
      );
    }

    await prisma.termCourse.createMany({
      data: courseIds.map((courseId) => ({ termId: termId as string, courseId })),
    });

    const termCourses = await prisma.termCourse.findMany({
      where: { termId: termId as string },
      include: { course: true },
    });

    return res.status(201).json({
      message: `${courseIds.length} course(s) added to term`,
      count: termCourses.length,
      courses: termCourses.map((tc) => tc.course),
    });
  };


  removeCoursesFromTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;
    const { courseIds }: { courseIds: string[] } = req.body;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);

    const result = await prisma.termCourse.deleteMany({
      where: { termId: termId as string, courseId: { in: courseIds } },
    });

    if (result.count === 0) {
      throw new AppError("none of the specified courses were found in this term", 404);
    }

    return res.status(200).json({
      message: `${result.count} course(s) removed from term`,
    });
  };


  getTermCourses = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);

    const termCourses = await prisma.termCourse.findMany({
      where: { termId: termId as string },
      include: {
        course: {
          include: { departments: true },
        },
      },
    });

    return res.status(200).json({
      count: termCourses.length,
      courses: termCourses.map((tc) => tc.course),
    });
  };


  publishGrades = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { publish }: { publish: boolean } = req.body;

    const term = await prisma.term.findUnique({ where: { id: id as string } });
    if (!term) throw new AppError("term not found", 404);

    const updated = await prisma.term.update({
      where: { id: id as string },
      data: { isGradesPublished: publish ?? true },
    });

    return res.status(200).json({
      message: publish ? "grades published to students" : "grades hidden from students",
      term: updated,
    });
  };


  setAppealsWindow = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { endDate }: { endDate: string } = req.body;

    const term = await prisma.term.findUnique({ where: { id: id as string } });
    if (!term) throw new AppError("term not found", 404);

    const updated = await prisma.term.update({
      where: { id: id as string },
      data: { appealsEndDate: new Date(endDate) },
    });

    return res.status(200).json({
      message: "appeals window updated",
      term: updated,
    });
  };
}

export default new TermService();