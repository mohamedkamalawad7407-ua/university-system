import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../../utils/classError";
import { addGradeSchemaType, updateGradeSchemaType } from "./Grade.validation";
import { resolveGradeFromScale, calculateGpa } from "./Grade.helper";

const prisma = new PrismaClient();

class GradeService {
  // ============ ADD GRADE ============
  addGrade = async (req: Request, res: Response, next: NextFunction) => {
    const { enrollmentId, score }: addGradeSchemaType = req.body;

    // 1. الـ enrollment موجود؟
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, term: true, student: true },
    });
    if (!enrollment) throw new AppError("enrollment not found", 404);
    if (enrollment.status === "DROPPED") {
      throw new AppError("cannot add grade to dropped enrollment", 400);
    }

    // 2. مش عنده grade قبل كده
    const existingGrade = await prisma.grade.findUnique({ where: { enrollmentId } });
    if (existingGrade) throw new AppError("grade already exists, use update instead", 409);

    // 3. حول الدرجة الرقمية لـ letter + gpaPoints من الـ GradeScale
    const { letterGrade, gpaPoints } = await resolveGradeFromScale(score, prisma);

    // 4. احفظ الـ grade
    const grade = await prisma.grade.create({
      data: { enrollmentId, score, letterGrade, gpaPoints },
    });

    // 5. احسب الـ GPA تاني
    await this.recalculateStudentGpa(enrollment.studentId, enrollment.termId);

    return res.status(201).json({ message: "grade added", grade });
  };

  // ============ UPDATE GRADE ============
  updateGrade = async (req: Request, res: Response, next: NextFunction) => {
    const { gradeId } = req.params;
    const { score }: updateGradeSchemaType = req.body;

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId as string },
      include: { enrollment: { include: { course: true } } },
    });
    if (!grade) throw new AppError("grade not found", 404);
    if (grade.isLocked) throw new AppError("grade is locked, cannot update", 400);

    const { letterGrade, gpaPoints } = await resolveGradeFromScale(score, prisma);

    const updated = await prisma.grade.update({
      where: { id: gradeId as string },
      data: { score, letterGrade, gpaPoints },
    });

    await this.recalculateStudentGpa(
      grade.enrollment.studentId,
      grade.enrollment.termId
    );

    return res.status(200).json({ message: "grade updated", grade: updated });
  };

  // ============ LOCK ONE GRADE ============
  lockGrade = async (req: Request, res: Response, next: NextFunction) => {
    const { gradeId } = req.params;

    const grade = await prisma.grade.findUnique({ where: { id: gradeId as string } });
    if (!grade) throw new AppError("grade not found", 404);
    if (grade.isLocked) throw new AppError("grade is already locked", 400);

    const updated = await prisma.grade.update({
      where: { id: gradeId as string },
      data: { isLocked: true },
    });

    return res.status(200).json({ message: "grade locked", grade: updated });
  };

  // ============ LOCK ALL GRADES IN TERM ============
  lockAllGradesInTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);

    const enrollments = await prisma.enrollment.findMany({
      where: { termId: termId as string, status: "ENROLLED" },
      select: { id: true },
    });

    const enrollmentIds = enrollments.map((e) => e.id);

    const result = await prisma.grade.updateMany({
      where: { enrollmentId: { in: enrollmentIds }, isLocked: false },
      data: { isLocked: true },
    });

    await prisma.termGpa.updateMany({
      where: { termId: termId as string, isLocked: false },
      data: { isLocked: true },
    });

    return res.status(200).json({
      message: "all grades locked",
      lockedCount: result.count,
    });
  };

  // ============ GET GRADES BY TERM (Admin) ============
  getGradesByTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;

    const grades = await prisma.grade.findMany({
      where: { enrollment: { termId: termId as string } },
      include: {
        enrollment: {
          include: {
            student: { select: { fullName: true, studentCode: true } },
            course: { select: { courseCode: true, creditHours: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ count: grades.length, grades });
  };

  // ============ GET MY GRADES (Student) ============
  getMyGrades = async (req: Request, res: Response, next: NextFunction) => {
    const studentId = (req.user as any).id;

    const termGpas = await prisma.termGpa.findMany({
      where: { studentId },
      include: { term: true },
      orderBy: { createdAt: "asc" },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId, status: "ENROLLED" },
      include: { course: true, term: true, grade: true },
      orderBy: { createdAt: "asc" },
    });

    const studentGpa = await prisma.studentGpa.findUnique({ where: { studentId } });

    // قسّم المواد على حسب السنة
    const byYear: Record<string, any[]> = {};
    for (const e of enrollments) {
      const year = e.course.yearNumber;
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push({
        enrollmentId: e.id,
        courseCode: e.course.courseCode,
        creditHours: e.course.creditHours,
        term: `${e.term.academicYear} - ${e.term.semester}`,
        score: e.grade?.score ?? null,
        letterGrade: e.grade?.letterGrade ?? null,
        gpaPoints: e.grade?.gpaPoints ?? null,
        isLocked: e.grade?.isLocked ?? false,
      });
    }

    return res.status(200).json({
      cumulativeGpa: studentGpa ? Number(studentGpa.cumulativeGpa) : 0,
      totalCredits: studentGpa?.totalCredits ?? 0,
      termGpas: termGpas.map(tg => ({ ...tg, gpa: Number(tg.gpa) })),
      coursesByYear: byYear,
    });
  };

  // ============ PRIVATE: RECALCULATE GPA ============
  private recalculateStudentGpa = async (studentId: string, termId: string) => {
    // ---- TERM GPA ----
    const termEnrollments = await prisma.enrollment.findMany({
      where: { studentId, termId, status: "ENROLLED" },
      include: { course: true, grade: true },
    });

    const termCoursesWithGrade = termEnrollments
      .filter((e) => e.grade !== null)
      .map((e) => ({
        gpaPoints: Number(e.grade!.gpaPoints),
        creditHours: e.course.creditHours,
      }));

    const termGpaValue = calculateGpa(termCoursesWithGrade);
    const termTotalCredits = termCoursesWithGrade.reduce(
      (sum, c) => sum + c.creditHours,
      0
    );

    await prisma.termGpa.upsert({
      where: { studentId_termId: { studentId, termId } },
      create: { studentId, termId, gpa: termGpaValue, totalCredits: termTotalCredits },
      update: { gpa: termGpaValue, totalCredits: termTotalCredits },
    });

    // ---- CUMULATIVE GPA ----
    const allEnrollments = await prisma.enrollment.findMany({
      where: { studentId, status: "ENROLLED" },
      include: { course: true, grade: true },
    });

    const allCoursesWithGrade = allEnrollments
      .filter((e) => e.grade !== null)
      .map((e) => ({
        gpaPoints: Number(e.grade!.gpaPoints),
        creditHours: e.course.creditHours,
      }));

    const cumulativeGpa = calculateGpa(allCoursesWithGrade);
    const totalCredits = allCoursesWithGrade.reduce(
      (sum, c) => sum + c.creditHours,
      0
    );

    await prisma.studentGpa.upsert({
      where: { studentId },
      create: { studentId, cumulativeGpa, totalCredits },
      update: { cumulativeGpa, totalCredits },
    });

    await prisma.student.update({
      where: { id: studentId },
      data: { gpa: cumulativeGpa },
    });
  };
}

export default new GradeService();