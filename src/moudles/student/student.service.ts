import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import { generateToken, getSignature, TokenType } from "../../utils/token";
import { signinStudentSchemaType, addStudentSchemaType } from "./sutdent.validation";
const { PDFParse } = require("pdf-parse");

const prisma = new PrismaClient();

class StudentService {
  // ============ SIGNIN ============
  signin = async (req: Request, res: Response, next: NextFunction) => {
    const { studentCode, nationalId }: signinStudentSchemaType = req.body;

    const student = await prisma.student.findUnique({
      where: { studentCode },
      include: { department: true },
    });

    if (!student || student.nationalId !== nationalId) {
      throw new AppError("student not found or invalid credentials", 401);
    }

    const signature = await getSignature(TokenType.access);
    const token = await generateToken({
      payload: { id: student.id, role: "student" },
      signature,
      options: { expiresIn: "1d" },
    });

    return res.status(200).json({ message: "signin success", token });
  };

  // ============ ADD ONE STUDENT (Admin) ============
  addStudent = async (req: Request, res: Response, next: NextFunction) => {
    const { studentCode, nationalId, fullName, currentYear, departmentId }: addStudentSchemaType =
      req.body;

    const exists = await prisma.student.findFirst({
      where: { OR: [{ studentCode }, { nationalId }] },
    });
    if (exists) throw new AppError("student already exists", 409);

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) throw new AppError("department not found", 404);

      const count = await prisma.student.count({ where: { departmentId } });
      if (count >= dept.maxStudents) throw new AppError("department is full", 400);
    }

    const student = await prisma.student.create({
      data: { studentCode, nationalId, fullName, currentYear, departmentId: departmentId || null },
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        currentYear: true,
        department: true,
      },
    });

    return res.status(201).json({ message: "student added successfully", student });
  };

  // ============ BULK ADD FROM PDF (Admin) ============
  addStudentsBulk = async (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).file) throw new AppError("PDF file is required", 400);

    const parser = new PDFParse({
      data: (req as any).file.buffer,
    });

    const pdfData = await parser.getText();

    const lines = (pdfData.text as string)
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const dataLines = lines.filter((line: string) => {
      return (
        !line.includes("fullName") &&
        !line.includes("studentCode") &&
        !line.startsWith("--") &&
        line.includes("|")
      );
    });

    const results = {
      success: [] as string[],
      failed: [] as { line: string; reason: string }[],
    };

    for (const line of dataLines) {
      // كل سطر: fullName | studentCode | nationalId | currentYear | departmentId(optional)
      const parts = line.split("|").map((p: string) => p.trim());

      if (parts.length < 4) {
        results.failed.push({ line, reason: "invalid format" });
        continue;
      }

      const [fullName, studentCode, nationalId, currentYear, departmentId] = parts as [string, string, string, string, string | undefined];

      const validYears = ["FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FOURTH_YEAR"];
      if (!validYears.includes(currentYear)) {
        results.failed.push({ line, reason: `invalid year: ${currentYear}` });
        continue;
      }

      try {
        const exists = await prisma.student.findFirst({
          where: { OR: [{ studentCode }, { nationalId }] },
        });
        if (exists) {
          results.failed.push({ line, reason: "student already exists" });
          continue;
        }

        await prisma.student.create({
          data: {
            fullName,
            studentCode,
            nationalId,
            currentYear: currentYear as any,
            departmentId: departmentId || null,
          },
        });

        results.success.push(studentCode);
      } catch (err) {
        results.failed.push({ line, reason: "database error" });
      }
    }

    return res.status(200).json({
      message: "bulk import done",
      total: dataLines.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      results,
    });
  };

  // ============ GET PROFILE (Student) ============
  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    const studentId = (req.user as any).id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        department: true,
        studentGpa: true,
        enrollments: {
          include: {
            course: true,
            term: true,
            grade: true,
          },
        },
      },
    });

    if (!student) throw new AppError("student not found", 404);

    const activeTerm = await prisma.term.findFirst({ where: { isActive: true } });

    const activeCourses = student.enrollments
      .filter((e) => e.termId === activeTerm?.id && e.status === "ENROLLED")
      .map((e) => ({
        enrollmentId: e.id,
        courseCode: e.course.courseCode,
        creditHours: e.course.creditHours,
        year: e.course.yearNumber,
      }));

    const completedCourses = student.enrollments
      .filter((e) => e.grade !== null && e.grade.isLocked)
      .map((e) => ({
        courseCode: e.course.courseCode,
        creditHours: e.course.creditHours,
        year: e.course.yearNumber,
        termYear: e.term.academicYear,
        semester: e.term.semester,
        letterGrade: e.grade?.letterGrade,
        gpaPoints: e.grade?.gpaPoints,
      }));

    return res.status(200).json({
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        currentYear: student.currentYear,
        department: student.department?.name,
        cumulativeGpa: student.studentGpa?.cumulativeGpa ?? 0,
        totalCredits: student.studentGpa?.totalCredits ?? 0,
      },
      activeCourses,
      completedCourses,
    });
  };

  // ============ GET ALL STUDENTS (Admin) ============
  getAllStudents = async (req: Request, res: Response, next: NextFunction) => {
    const { departmentId, currentYear } = req.query;

    const students = await prisma.student.findMany({
      where: {
        ...(departmentId && { departmentId: departmentId as string }),
        ...(currentYear && { currentYear: currentYear as any }),
      },
      include: {
        department: true,
        studentGpa: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ count: students.length, students });
  };

  // ============ GET ONE STUDENT (Admin) ============
  getStudent = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: id as string },
      include: {
        department: true,
        studentGpa: true,
        termGpas: { include: { term: true } },
        enrollments: {
          include: { course: true, term: true, grade: true },
        },
      },
    });

    if (!student) throw new AppError("student not found", 404);
    return res.status(200).json({ student });
  };

  // ============ DELETE STUDENT (Admin) ============
  deleteStudent = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const student = await prisma.student.findUnique({ where: { id: id as string } });
    if (!student) throw new AppError("student not found", 404);

    await prisma.student.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "student deleted" });
  };
}

export default new StudentService();