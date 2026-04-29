import { NextFunction, Request, Response } from "express";
import { PrismaClient, LetterGrade } from "@prisma/client";
import { AppError } from "../../utils/classError";
import {
  createGradeScaleSchemaType,
  updateGradeScaleSchemaType,
  bulkCreateGradeScaleSchemaType,
} from "./Gradescale.validation";

const prisma = new PrismaClient();

class GradeScaleService {
  // ============ CREATE ONE ============
  createScale = async (req: Request, res: Response, next: NextFunction) => {
    const { letterGrade, minScore, maxScore, gpaPoints }: createGradeScaleSchemaType = req.body;

    const exists = await prisma.gradeScale.findUnique({ 
      where: { letterGrade: letterGrade as LetterGrade } 
    });
    if (exists) throw new AppError(`grade scale for ${letterGrade} already exists`, 409);

    // تحقق مفيش overlap في الـ score range
    const overlapping = await prisma.gradeScale.findFirst({
      where: {
        AND: [
          { minScore: { lt: maxScore } },
          { maxScore: { gt: minScore } },
        ],
      },
    });
    if (overlapping) {
      throw new AppError(
        `score range overlaps with ${overlapping.letterGrade} (${overlapping.minScore} - ${overlapping.maxScore})`,
        409
      );
    }

    const scale = await prisma.gradeScale.create({
      data: { letterGrade: letterGrade as LetterGrade, minScore, maxScore, gpaPoints },
    });

    return res.status(201).json({ message: "grade scale created", scale });
  };

  // ============ BULK CREATE (replace all) ============
  bulkCreate = async (req: Request, res: Response, next: NextFunction) => {
    const { scales }: bulkCreateGradeScaleSchemaType = req.body;

    // تحقق مفيش تكرار في الـ letterGrade
    const letters = scales.map((s) => s.letterGrade);
    if (new Set(letters).size !== letters.length) {
      throw new AppError("duplicate letterGrade in scales", 400);
    }

    // تحقق مفيش overlap في الـ ranges
    for (let i = 0; i < scales.length; i++) {
      for (let j = i + 1; j < scales.length; j++) {
        const a = scales[i]!;
        const b = scales[j]!;
        if (a.minScore < b.maxScore && a.maxScore > b.minScore) {
          throw new AppError(
            `score range overlap between ${a.letterGrade} and ${b.letterGrade}`,
            400
          );
        }
      }
    }

    // امسح القديم وحط الجديد في transaction
    const result = await prisma.$transaction(async (tx) => {
      await tx.gradeScale.deleteMany();
      return tx.gradeScale.createMany({ 
        data: scales.map(s => ({ ...s, letterGrade: s.letterGrade as LetterGrade })) 
      });
    });

    const allScales = await prisma.gradeScale.findMany({
      orderBy: { minScore: "desc" },
    });

    return res.status(201).json({
      message: "grade scale set successfully",
      count: result.count,
      scales: allScales,
    });
  };

  // ============ GET ALL ============
  getAllScales = async (req: Request, res: Response, next: NextFunction) => {
    const scales = await prisma.gradeScale.findMany({
      orderBy: { minScore: "desc" },
    });
    return res.status(200).json({ scales });
  };

  // ============ UPDATE ONE ============
  updateScale = async (req: Request, res: Response, next: NextFunction) => {
    const { id: oldLetterGrade } = req.params;
    const { letterGrade, minScore, maxScore, gpaPoints }: updateGradeScaleSchemaType = req.body;

    const scale = await prisma.gradeScale.findUnique({ 
      where: { letterGrade: oldLetterGrade as LetterGrade } 
    });
    if (!scale) throw new AppError("grade scale not found", 404);

    // لو بيغير الـ letterGrade تأكد مش متكرر
    if (letterGrade && letterGrade !== scale.letterGrade) {
      const exists = await prisma.gradeScale.findUnique({ 
        where: { letterGrade: letterGrade as LetterGrade } 
      });
      if (exists) throw new AppError(`grade scale for ${letterGrade} already exists`, 409);
    }

    const updated = await prisma.gradeScale.update({
      where: { letterGrade: oldLetterGrade as LetterGrade },
      data: {
        ...(letterGrade && { letterGrade: letterGrade as LetterGrade }),
        ...(minScore !== undefined && { minScore }),
        ...(maxScore !== undefined && { maxScore }),
        ...(gpaPoints !== undefined && { gpaPoints }),
      },
    });

    return res.status(200).json({ message: "grade scale updated", scale: updated });
  };

  // ============ DELETE ONE ============
  deleteScale = async (req: Request, res: Response, next: NextFunction) => {
    const { id: letterGrade } = req.params;

    const scale = await prisma.gradeScale.findUnique({ 
      where: { letterGrade: letterGrade as LetterGrade } 
    });
    if (!scale) throw new AppError("grade scale not found", 404);

    await prisma.gradeScale.delete({ 
      where: { letterGrade: letterGrade as LetterGrade } 
    });
    return res.status(200).json({ message: "grade scale deleted" });
  };

  // ============ DELETE ALL ============
  deleteAllScales = async (req: Request, res: Response, next: NextFunction) => {
    await prisma.gradeScale.deleteMany();
    return res.status(200).json({ message: "all grade scales deleted" });
  };
}

export default new GradeScaleService();