import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import { createTermSchemaType } from "./Term.validation";
import { updateRegistrationWindowSchemaType } from "./Term.validation";



const prisma = new PrismaClient();

class TermService {
  // ============ CREATE TERM + REGISTRATION WINDOWS ============
  createTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { academicYear, semester, registrationWindows }: createTermSchemaType = req.body;

    // تأكد مفيش ترم متكرر
    const exists = await prisma.term.findUnique({
      where: { academicYear_semester: { academicYear, semester } },
    });
    if (exists) throw new AppError("term already exists", 409);

    // تحقق ان مفيش dates متداخلة في الـ windows
    for (const w of registrationWindows) {
      if (new Date(w.endDate) <= new Date(w.startDate)) {
        throw new AppError(`window for ${w.year}: endDate must be after startDate`, 400);
      }
    }

    // create الترم + الـ windows في transaction
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

  // ============ GET ALL TERMS ============
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

  // ============ GET ONE TERM ============
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

    // حالة التسجيل الحالية لكل سنة
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

  // ============ OPEN TERM ============
  openTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const term = await prisma.term.findUnique({
      where: { id: id as string },
      include: { registrationWindows: true },
    });
    if (!term) throw new AppError("term not found", 404);
    if (term.isActive) throw new AppError("term is already open", 400);

    // لازم يكون فيه على الأقل window واحدة
    if (term.registrationWindows.length === 0) {
      throw new AppError("cannot open term without registration windows", 400);
    }

    // لازم يكون في ترم واحد بس مفتوح
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

  // ============ CLOSE TERM ============
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

  // ============ UPDATE REGISTRATION WINDOW ============
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

  // ============ ADD REGISTRATION WINDOW ============
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

  // ============ DELETE TERM ============
  deleteTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const term = await prisma.term.findUnique({ where: { id: id as string } });
    if (!term) throw new AppError("term not found", 404);
    if (term.isActive) throw new AppError("cannot delete an active term", 400);

    await prisma.term.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "term deleted" });
  };

  // ============ GET ACTIVE TERM (Student) ============
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
}

export default new TermService();