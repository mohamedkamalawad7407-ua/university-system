import { NextFunction, Request, Response } from "express";
import { PrismaClient, StudyYear } from "@prisma/client";
import { AppError } from "../../utils/classError";
import {
  createPromotionRuleSchemaType,
  updatePromotionRuleSchemaType,
} from "./Promotion.validation";

const prisma = new PrismaClient();

const yearOrder: Record<StudyYear, number> = {
  FIRST_YEAR: 1,
  SECOND_YEAR: 2,
  THIRD_YEAR: 3,
  FOURTH_YEAR: 4,
};

const nextYear: Record<string, StudyYear | null> = {
  FIRST_YEAR: "SECOND_YEAR",
  SECOND_YEAR: "THIRD_YEAR",
  THIRD_YEAR: "FOURTH_YEAR",
  FOURTH_YEAR: null,
};

class PromotionService {

  createRule = async (req: Request, res: Response, next: NextFunction) => {
    const { fromYear, minCredits }: createPromotionRuleSchemaType = req.body;

    if (fromYear === "FOURTH_YEAR") {
      throw new AppError("cannot create promotion rule for FOURTH_YEAR (graduation)", 400);
    }

    const exists = await prisma.promotionRule.findUnique({ where: { fromYear } });
    if (exists) throw new AppError(`promotion rule for ${fromYear} already exists`, 409);

    const rule = await prisma.promotionRule.create({
      data: { fromYear, minCredits },
    });

    return res.status(201).json({ message: "promotion rule created", rule });
  };


  getAllRules = async (req: Request, res: Response, next: NextFunction) => {
    const rules = await prisma.promotionRule.findMany({
      orderBy: { fromYear: "asc" },
    });
    return res.status(200).json({ rules });
  };


  updateRule = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { minCredits }: updatePromotionRuleSchemaType = req.body;

    const rule = await prisma.promotionRule.findUnique({ where: { id: id as string } });
    if (!rule) throw new AppError("promotion rule not found", 404);

    const updated = await prisma.promotionRule.update({
      where: { id: id as string },
      data: { minCredits },
    });

    return res.status(200).json({ message: "promotion rule updated", rule: updated });
  };


  deleteRule = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const rule = await prisma.promotionRule.findUnique({ where: { id: id as string } });
    if (!rule) throw new AppError("promotion rule not found", 404);

    await prisma.promotionRule.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "promotion rule deleted" });
  };


  promoteStudents = async (req: Request, res: Response, next: NextFunction) => {

    const rules = await prisma.promotionRule.findMany();
    if (rules.length === 0) {
      throw new AppError("no promotion rules configured, please add rules first", 400);
    }

    const rulesMap = new Map(rules.map((r) => [r.fromYear, r.minCredits]));


    const students = await prisma.student.findMany({
      where: { currentYear: { not: "FOURTH_YEAR" } },
      include: { studentGpa: true },
    });

    const promoted: { studentCode: string; fullName: string; from: string; to: string }[] = [];
    const stayed: { studentCode: string; fullName: string; year: string; passedCredits: number; required: number }[] = [];

    for (const student of students) {
      const minCredits = rulesMap.get(student.currentYear);
      if (minCredits === undefined) {

        stayed.push({
          studentCode: student.studentCode,
          fullName: student.fullName,
          year: student.currentYear,
          passedCredits: student.studentGpa?.totalCredits ?? 0,
          required: -1,
        });
        continue;
      }


      const passedEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: student.id,
          status: "ENROLLED",
          grade: {
            letterGrade: { not: "F" },
            isLocked: true,
          },
        },
        include: { course: { select: { creditHours: true } } },
      });

      const passedCredits = passedEnrollments.reduce(
        (sum, e) => sum + e.course.creditHours,
        0
      );

      const toYear = nextYear[student.currentYear];

      if (passedCredits >= minCredits && toYear) {

        await prisma.student.update({
          where: { id: student.id },
          data: { currentYear: toYear },
        });
        promoted.push({
          studentCode: student.studentCode,
          fullName: student.fullName,
          from: student.currentYear,
          to: toYear,
        });
      } else {
        stayed.push({
          studentCode: student.studentCode,
          fullName: student.fullName,
          year: student.currentYear,
          passedCredits,
          required: minCredits,
        });
      }
    }

    return res.status(200).json({
      message: "promotion process completed",
      promotedCount: promoted.length,
      stayedCount: stayed.length,
      promoted,
      stayed,
    });
  };


  previewPromotion = async (req: Request, res: Response, next: NextFunction) => {
    const rules = await prisma.promotionRule.findMany();
    if (rules.length === 0) {
      throw new AppError("no promotion rules configured", 400);
    }

    const rulesMap = new Map(rules.map((r) => [r.fromYear, r.minCredits]));

    const students = await prisma.student.findMany({
      where: { currentYear: { not: "FOURTH_YEAR" } },
      include: { studentGpa: true },
    });

    const willPromote: any[] = [];
    const willStay: any[] = [];

    for (const student of students) {
      const minCredits = rulesMap.get(student.currentYear);
      if (minCredits === undefined) {
        willStay.push({
          studentCode: student.studentCode,
          fullName: student.fullName,
          year: student.currentYear,
          passedCredits: student.studentGpa?.totalCredits ?? 0,
          reason: "no promotion rule for this year",
        });
        continue;
      }

      const passedEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId: student.id,
          status: "ENROLLED",
          grade: {
            letterGrade: { not: "F" },
            isLocked: true,
          },
        },
        include: { course: { select: { creditHours: true } } },
      });

      const passedCredits = passedEnrollments.reduce(
        (sum, e) => sum + e.course.creditHours,
        0
      );

      const toYear = nextYear[student.currentYear];

      if (passedCredits >= minCredits && toYear) {
        willPromote.push({
          studentCode: student.studentCode,
          fullName: student.fullName,
          from: student.currentYear,
          to: toYear,
          passedCredits,
          required: minCredits,
        });
      } else {
        willStay.push({
          studentCode: student.studentCode,
          fullName: student.fullName,
          year: student.currentYear,
          passedCredits,
          required: minCredits,
          remaining: minCredits - passedCredits,
        });
      }
    }

    return res.status(200).json({
      message: "promotion preview (no changes applied)",
      willPromoteCount: willPromote.length,
      willStayCount: willStay.length,
      willPromote,
      willStay,
    });
  };
}

export default new PromotionService();
