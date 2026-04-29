import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import {
  createDepartmentSchemaType,
  updateDepartmentSchemaType,
  assignStudentSchemaType,
} from "./Department.validation";

const prisma = new PrismaClient();

class DepartmentService {
  // ============ CREATE ============
  createDepartment = async (req: Request, res: Response, next: NextFunction) => {
    const { name, maxStudents, minGpa }: createDepartmentSchemaType = req.body;

    const exists = await prisma.department.findUnique({ where: { name } });
    if (exists) throw new AppError("department already exists", 409);

    const department = await prisma.department.create({
      data: { name, maxStudents, minGpa },
    });

    return res.status(201).json({ message: "department created", department });
  };

  // ============ GET ALL ============
  getAllDepartments = async (req: Request, res: Response, next: NextFunction) => {
    const departments = await prisma.department.findMany({
      include: {
        _count: { select: { students: true, courses: true } },
      },
      orderBy: { name: "asc" },
    });

    return res.status(200).json({ departments });
  };

  // ============ GET ONE ============
  getDepartment = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: id as string },
      include: {
        courses: true,
        students: {
          select: {
            id: true,
            fullName: true,
            studentCode: true,
            currentYear: true,
            gpa: true,
          },
        },
        _count: { select: { students: true, courses: true } },
      },
    });

    if (!department) throw new AppError("department not found", 404);

    return res.status(200).json({ department });
  };

  // ============ UPDATE ============
  updateDepartment = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, maxStudents, minGpa }: updateDepartmentSchemaType = req.body;

    const department = await prisma.department.findUnique({ where: { id: id as string } });
    if (!department) throw new AppError("department not found", 404);

    if (name && name !== department.name) {
      const nameExists = await prisma.department.findUnique({ where: { name } });
      if (nameExists) throw new AppError("department name already taken", 409);
    }

    if (maxStudents) {
      const currentCount = await prisma.student.count({ where: { departmentId: id as string } });
      if (maxStudents < currentCount) {
        throw new AppError(
          `cannot set maxStudents to ${maxStudents}, current students count is ${currentCount}`,
          400
        );
      }
    }

    const updated = await prisma.department.update({
      where: { id : id as string },
      data: {
        ...(name && { name }),
        ...(maxStudents && { maxStudents }),
        ...(minGpa !== undefined && { minGpa }),
      },
    });

    return res.status(200).json({ message: "department updated", department: updated });
  };

  // ============ DELETE ============
  deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id: id as string },
      include: { _count: { select: { students: true } } },
    });
    if (!department) throw new AppError("department not found", 404);

    if (department._count.students > 0) {
      throw new AppError(
        `cannot delete department with ${department._count.students} students`,
        400
      );
    }

    await prisma.department.delete({ where: { id: id as string } });
    return res.status(200).json({ message: "department deleted" });
  };

  // ============ ASSIGN STUDENT TO DEPARTMENT ============
  assignStudent = async (req: Request, res: Response, next: NextFunction) => {
    const { studentId, departmentId }: assignStudentSchemaType = req.body;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { studentGpa: true },
    });
    if (!student) throw new AppError("student not found", 404);

    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new AppError("department not found", 404);

    if (student.departmentId && student.departmentId !== departmentId) {
      throw new AppError("student already assigned to another department", 400);
    }

    const currentCount = await prisma.student.count({ where: { departmentId } });
    if (currentCount >= department.maxStudents) {
      throw new AppError("department is full", 400);
    }

    const studentGpa = Number(student.studentGpa?.cumulativeGpa ?? 0);
    const minGpa = Number(department.minGpa);
    
    // يسمح لطلاب السنة الأولى بالدخول للقسم حتى لو المعدل أقل من المطلوب (لحالات أقسام الكريديت)
    if (student.currentYear !== "FIRST_YEAR" && studentGpa < minGpa) {
      throw new AppError(
        `student GPA ${studentGpa} is below department minimum ${minGpa}`,
        400
      );
    }

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { departmentId },
      select: {
        id: true,
        fullName: true,
        studentCode: true,
        currentYear: true,
        gpa: true,
        department: true,
      },
    });

    return res.status(200).json({ message: "student assigned to department", student: updated });
  };

  // ============ REMOVE STUDENT FROM DEPARTMENT ============
  removeStudent = async (req: Request, res: Response, next: NextFunction) => {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({ where: { id: studentId as string } });
    if (!student) throw new AppError("student not found", 404);
    if (!student.departmentId) throw new AppError("student has no department", 400);

    const activeEnrollments = await prisma.enrollment.findFirst({
      where: { studentId: studentId as string , status: "ENROLLED", term: { isActive: true } },
    });
    if (activeEnrollments) {
      throw new AppError("cannot remove student with active enrollments", 400);
    }

    const updated = await prisma.student.update({
      where: { id: studentId as string},
      data: { departmentId: null },
      select: { id: true, fullName: true, studentCode: true },
    });

    return res.status(200).json({ message: "student removed from department", student: updated });
  };

  // ============ GET DEPARTMENT STATS ============
  getDepartmentStats = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const department = await prisma.department.findUnique({ where: { id: id as string } });
    if (!department) throw new AppError("department not found", 404);

    const students = await prisma.student.findMany({
      where: { departmentId: id as string },
      include: { studentGpa: true },
    });

    const totalStudents = students.length;
    const availableSlots = department.maxStudents - totalStudents;

    const byYear = students.reduce(
      (acc, s) => {
        acc[s.currentYear] = (acc[s.currentYear] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const gpas = students
      .map((s) => Number(s.studentGpa?.cumulativeGpa ?? 0))
      .filter((g) => g > 0);

    const avgGpa =
      gpas.length > 0
        ? Math.round((gpas.reduce((a, b) => a + b, 0) / gpas.length) * 100) / 100
        : 0;

    return res.status(200).json({
      department: {
        id: department.id,
        name: department.name,
        maxStudents: department.maxStudents,
        minGpa: department.minGpa,
      },
      stats: { totalStudents, availableSlots, avgGpa, byYear },
    });
  };
}

export default new DepartmentService();