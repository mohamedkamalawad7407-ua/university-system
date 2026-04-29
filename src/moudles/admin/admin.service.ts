import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { HASH } from "../../utils/hash";
import { AppError } from "../../utils/classError";
import { signinAdminSchemaType, signupAdminSchemaType } from "./admin.validation";
import { compare } from "bcrypt";
import { generateToken, getSignature, TokenType } from "../../utils/token";

const prisma = new PrismaClient();

class AdminService {
  signup = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password }: signupAdminSchemaType = req.body;

    if (await prisma.admin.findUnique({ where: { email } })) {
      throw new AppError("email already exist", 409);
    }

    const hash = await HASH(password);
    const admin = await prisma.admin.create({
      data: { email, password: hash },
      select: { id: true, email: true, createdAt: true },
    });

    return res.status(201).json({ message: "admin created successfully", admin });
  };

  signin = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password }: signinAdminSchemaType = req.body;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      throw new AppError("invalid credentials", 401);
    }

    if (!(await compare(password, admin.password))) {
      throw new AppError("invalid credentials", 401);
    }

    const signature = await getSignature(TokenType.access);
    const token = await generateToken({
      payload: { id: admin.id, role: "admin" },
      signature,
      options: { expiresIn: "1d" },
    });

    return res.status(200).json({ message: "signin success", token });
  };
}

export default new AdminService();