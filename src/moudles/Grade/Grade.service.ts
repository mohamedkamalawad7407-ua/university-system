import { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/classError";
import { addGradeSchemaType, updateGradeSchemaType } from "./Grade.validation";
import { resolveGradeFromScale, calculateGpa } from "./Grade.helper";
import prisma from "../../utils/prisma";


class GradeService {

  addGrade = async (req: Request, res: Response, next: NextFunction) => {
    const { enrollmentId, score }: addGradeSchemaType = req.body;


    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: true, term: true, student: true },
    });
    if (!enrollment) throw new AppError("enrollment not found", 404);
    if (enrollment.status === "DROPPED") {
      throw new AppError("cannot add grade to dropped enrollment", 400);
    }


    const existingGrade = await prisma.grade.findUnique({ where: { enrollmentId } });
    if (existingGrade) throw new AppError("grade already exists, use update instead", 409);


    const { letterGrade, gpaPoints } = await resolveGradeFromScale(score, prisma);


    const grade = await prisma.grade.create({
      data: { enrollmentId, score, letterGrade, gpaPoints },
    });


    await this.recalculateStudentGpa(enrollment.studentId, enrollment.termId);

    return res.status(201).json({ message: "grade added", grade });
  };


  addGradesBulk = async (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).file) throw new AppError("CSV file is required", 400);
    const { termId, courseId } = req.body;

    if (!termId || !courseId) {
      throw new AppError("termId and courseId are required", 400);
    }

    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new AppError("term not found", 404);

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError("course not found", 404);

    const csvData = (req as any).file.buffer.toString("utf-8");
    const lines = csvData
      .split(/\r?\n/)
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);

    const results = {
      success: [] as string[],
      failed: [] as { studentCode: string; reason: string }[],
    };

    // Parse CSV records
    interface CsvRecord {
      studentCode: string;
      score: number;
      lineNumber: number;
    }
    const parsedRecords: CsvRecord[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes("code") || line.toLowerCase().includes("score"))) {
        continue;
      }

      const parts = line.split(",").map((p: string) => p.trim());
      if (parts.length < 2) {
        results.failed.push({ studentCode: `Line ${i + 1}`, reason: "invalid format, expected code,score" });
        continue;
      }

      const studentCode = parts[0];
      const scoreStr = parts[1];
      const score = Number(scoreStr);

      if (!studentCode) {
        results.failed.push({ studentCode: `Line ${i + 1}`, reason: "student code is empty" });
        continue;
      }

      if (isNaN(score) || score < 0 || score > 100) {
        results.failed.push({ studentCode, reason: `invalid score: ${scoreStr}` });
        continue;
      }

      parsedRecords.push({ studentCode, score, lineNumber: i + 1 });
    }

    if (parsedRecords.length === 0) {
      return res.status(200).json({
        message: "bulk grades processing done (no records processed)",
        totalProcessed: lines.length,
        successCount: 0,
        failedCount: results.failed.length,
        results,
      });
    }

    // 1. Fetch all grade scales in memory
    const gradeScales = await prisma.gradeScale.findMany();
    const resolveGradeFromMemory = (score: number) => {
      const scale = gradeScales.find((s) => score >= Number(s.minScore) && score <= Number(s.maxScore));
      if (!scale) return null;
      return {
        letterGrade: scale.letterGrade,
        gpaPoints: Number(scale.gpaPoints),
      };
    };

    // 2. Fetch all unique students
    const studentCodes = Array.from(new Set(parsedRecords.map((r) => r.studentCode)));
    const students = await prisma.student.findMany({
      where: { studentCode: { in: studentCodes } },
    });

    const studentMap = new Map<string, any>();
    for (const student of students) {
      studentMap.set(student.studentCode, student);
    }

    // 3. Fetch all enrollments with grades for these students in this term/course
    const studentIds = students.map((s) => s.id);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: { in: studentIds },
        courseId,
        termId,
      },
      include: { grade: true },
    });

    const enrollmentMap = new Map<string, any>();
    for (const enrollment of enrollments) {
      enrollmentMap.set(enrollment.studentId, enrollment);
    }

    // 4. Build batch transactions and update results
    const prismaTxOperations: any[] = [];
    const successfulStudentIds = new Set<string>();

    for (const record of parsedRecords) {
      const { studentCode, score } = record;
      const student = studentMap.get(studentCode);

      if (!student) {
        results.failed.push({ studentCode, reason: "student not found" });
        continue;
      }

      const enrollment = enrollmentMap.get(student.id);
      if (!enrollment) {
        results.failed.push({ studentCode, reason: "student not enrolled in this course in this term" });
        continue;
      }

      if (enrollment.status === "DROPPED") {
        results.failed.push({ studentCode, reason: "course was dropped by student" });
        continue;
      }

      const existingGrade = enrollment.grade;
      const gradeScaleResolved = resolveGradeFromMemory(score);

      if (!gradeScaleResolved) {
        results.failed.push({
          studentCode,
          reason: `no grade scale found for score ${score}, configure grade scales first`,
        });
        continue;
      }

      const { letterGrade, gpaPoints } = gradeScaleResolved;

      if (existingGrade) {
        if (existingGrade.isLocked) {
          results.failed.push({ studentCode, reason: "grade already exists and is locked" });
          continue;
        }

        prismaTxOperations.push(
          prisma.grade.update({
            where: { id: existingGrade.id },
            data: { score, letterGrade, gpaPoints },
          })
        );
      } else {
        prismaTxOperations.push(
          prisma.grade.create({
            data: { enrollmentId: enrollment.id, score, letterGrade, gpaPoints },
          })
        );
      }

      successfulStudentIds.add(student.id);
      results.success.push(studentCode);
    }

    // 5. Execute database transaction for all creations/updates
    if (prismaTxOperations.length > 0) {
      await prisma.$transaction(prismaTxOperations);
    }

    // 6. Recalculate GPA in chunks of 30 for safety and performance
    const chunkArray = <T>(array: T[], size: number): T[][] => {
      const chunked: T[][] = [];
      for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
      }
      return chunked;
    };

    const studentIdArray = Array.from(successfulStudentIds);
    const chunks = chunkArray(studentIdArray, 30);
    for (const chunk of chunks) {
      await Promise.all(chunk.map((studentId) => this.recalculateStudentGpa(studentId, termId)));
    }

    return res.status(200).json({
      message: "bulk grades processing done",
      totalProcessed: lines.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      results,
    });
  };


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


  lockAllGradesInTerm = async (req: Request, res: Response, next: NextFunction) => {
    const { termId } = req.params;

    const term = await prisma.term.findUnique({ where: { id: termId as string } });
    if (!term) throw new AppError("term not found", 404);

    if (term.appealsEndDate && new Date() < term.appealsEndDate) {
      throw new AppError(
        `cannot lock grades until appeals window is closed (ends on ${term.appealsEndDate.toISOString()})`,
        400
      );
    }

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


  getMyGrades = async (req: Request, res: Response, next: NextFunction) => {
    const studentId = (req.user as any).id;

    const termGpas = await prisma.termGpa.findMany({
      where: { studentId },
      include: { term: true },
      orderBy: { createdAt: "asc" },
    });

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId,
        status: "ENROLLED",
        term: { isGradesPublished: true },
        OR: [
          { grade: null },
          { grade: { isLocked: false } }
        ]
      },
      include: { course: true, term: true, grade: true },
      orderBy: { createdAt: "asc" },
    });

    const studentGpa = await prisma.studentGpa.findUnique({ where: { studentId } });


    const byTerm: Record<string, { termInfo: any, courses: any[], termGpa: any }> = {};

    for (const e of enrollments) {
      const termKey = `${e.term.academicYear} - ${e.term.semester}`;

      if (!byTerm[termKey]) {
        const tGpa = termGpas.find(tg => tg.termId === e.termId);
        byTerm[termKey] = {
          termInfo: {
            id: e.termId,
            academicYear: e.term.academicYear,
            semester: e.term.semester,
            isPublished: e.term.isGradesPublished,
            appealsEndDate: e.term.appealsEndDate,
          },
          termGpa: e.term.isGradesPublished && tGpa ? Number(tGpa.gpa) : null,
          courses: [],
        };
      }

      const isPublished = e.term.isGradesPublished;

      byTerm[termKey].courses.push({
        enrollmentId: e.id,
        courseCode: e.course.courseCode,
        courseName: e.course.name,
        creditHours: e.course.creditHours,
        score: isPublished ? (e.grade?.score ?? null) : "Not Published Yet",
        letterGrade: isPublished ? (e.grade?.letterGrade ?? null) : "N/A",
        gpaPoints: isPublished ? (e.grade?.gpaPoints ?? null) : 0,
        isLocked: e.grade?.isLocked ?? false,
      });
    }

    const displayedCoursesWithGrades = enrollments
      .filter((e) => e.grade !== null && e.term.isGradesPublished)
      .map((e) => ({
        gpaPoints: Number(e.grade!.gpaPoints),
        creditHours: e.course.creditHours,
      }));

    const currentDisplayGpa = calculateGpa(displayedCoursesWithGrades);
    const currentDisplayCredits = displayedCoursesWithGrades.reduce(
      (sum, c) => sum + c.creditHours,
      0
    );

    return res.status(200).json({
      cumulativeGpa: currentDisplayGpa,
      totalCredits: currentDisplayCredits,
      resultsByTerm: byTerm,
    });
  };


  private recalculateStudentGpa = async (studentId: string, termId: string) => {

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