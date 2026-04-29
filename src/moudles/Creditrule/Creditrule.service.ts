import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import {
  createCreditRuleSchemaType,
  updateCreditRuleSchemaType,
} from "./Creditrule.validation";

const prisma = new PrismaClient();

class CreditRuleService {
  // ============ CREATE ============
  createRule = async (req: Request, res: Response, next: NextFunction) => {
    const { minGpa, maxGpa, maxCredits }: createCreditRuleSchemaType = req.body;

    // تأكد مفيش overlap مع rules موجودة
    const overlapping = await prisma.creditRule.findFirst({
      where: {
        AND: [
          { minGpa: { lte: maxGpa ?? 4 } },
          {
            OR: [{ maxGpa: null }, { maxGpa: { gte: minGpa } }],
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

    const rule = await prisma.creditRule.create({
      data: { minGpa, maxGpa: maxGpa ?? null, maxCredits },
    });

    return res.status(201).json({ message: "credit rule created", rule });
  };

  // ============ GET ALL ============
  getAllRules = async (req: Request, res: Response, next: NextFunction) => {
    const rules = await prisma.creditRule.findMany({
      orderBy: { minGpa: "asc" },
    });
    return res.status(200).json({ rules });
  };

  // ============ UPDATE ============
  updateRule = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { minGpa, maxGpa, maxCredits }: updateCreditRuleSchemaType = req.body;

    const rule = await prisma.creditRule.findUnique({ where: { id: id as string} });
    if (!rule) throw new AppError("credit rule not found", 404);

    const updated = await prisma.creditRule.update({
      where: { id: id as string },
      data: {
        ...(minGpa !== undefined && { minGpa }),
        ...(maxGpa !== undefined && { maxGpa }),
        ...(maxCredits !== undefined && { maxCredits }),
      },
    });

    return res.status(200).json({ message: "credit rule updated", rule: updated });
  };

  // ============ DELETE ============
  deleteRule = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const rule = await prisma.creditRule.findUnique({ where: { id: id as string } });
    if (!rule) throw new AppError("credit rule not found", 404);

    await prisma.creditRule.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "credit rule deleted" });
  };
}

export default new CreditRuleService();