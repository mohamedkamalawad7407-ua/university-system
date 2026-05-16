import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import {
  createCreditRuleSchemaType,
  updateCreditRuleSchemaType,
} from "./Creditrule.validation";

const prisma = new PrismaClient();

class CreditRuleService {

  createRule = async (req: Request, res: Response, next: NextFunction) => {
    const { minGpa, maxGpa, maxCredits, isForNewStudents }: createCreditRuleSchemaType = req.body;

    if (!isForNewStudents) {
      const overlapping = await prisma.creditRule.findFirst({
        where: {
          isForNewStudents: false,
          AND: [
            { minGpa: { lte: maxGpa ?? 4 } },
            {
              OR: [{ maxGpa: null },
              { maxGpa: { gt: minGpa } }],
            },
          ],
        },
      });

      if (overlapping) {
        throw new AppError(
          `GPA range overlaps with existing rule (${overlapping.minGpa} - ${overlapping.maxGpa ?? "∞"})`,
          409
        );
      }
    }

    if (isForNewStudents) {
      await prisma.creditRule.updateMany({
        where: { isForNewStudents: true },
        data: { isForNewStudents: false },
      });
    }

    const rule = await prisma.creditRule.create({
      data: { minGpa, maxGpa: maxGpa ?? null, maxCredits, isForNewStudents: isForNewStudents ?? false },
    });

    return res.status(201).json({ message: "credit rule created", rule });
  };


  getAllRules = async (req: Request, res: Response, next: NextFunction) => {
    const rules = await prisma.creditRule.findMany({
      orderBy: { minGpa: "asc" },
    });
    return res.status(200).json({ rules });
  };


  updateRule = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { minGpa, maxGpa, maxCredits, isForNewStudents }: updateCreditRuleSchemaType = req.body;

    const rule = await prisma.creditRule.findUnique({ where: { id: id as string } });
    if (!rule) throw new AppError("credit rule not found", 404);

    if (isForNewStudents) {
      await prisma.creditRule.updateMany({
        where: { isForNewStudents: true, id: { not: id as string } },
        data: { isForNewStudents: false },
      });
    }

    const updated = await prisma.creditRule.update({
      where: { id: id as string },
      data: {
        ...(minGpa !== undefined && { minGpa }),
        ...(maxGpa !== undefined && { maxGpa }),
        ...(maxCredits !== undefined && { maxCredits }),
        ...(isForNewStudents !== undefined && { isForNewStudents }),
      },
    });

    return res.status(200).json({ message: "credit rule updated", rule: updated });
  };


  deleteRule = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const rule = await prisma.creditRule.findUnique({ where: { id: id as string } });
    if (!rule) throw new AppError("credit rule not found", 404);

    await prisma.creditRule.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "credit rule deleted" });
  };
}

export default new CreditRuleService();