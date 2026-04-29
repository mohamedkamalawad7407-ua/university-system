import { NextFunction, Request, Response } from "express";
import { PrismaClient, StudyYear } from "@prisma/client";
import { AppError } from "../../utils/classError";
import { enrollSchemaType } from "./Enrollment.validation";

const prisma = new PrismaClient();

const yearOrder: Record<StudyYear, number> = {
  FIRST_YEAR: 1,
  SECOND_YEAR: 2,
  THIRD_YEAR: 3,
  FOURTH_YEAR: 4,
};

const minGpaForYear: Record<StudyYear, number> = {
  FIRST_YEAR: 0,
  SECOND_YEAR: 1.0,
  THIRD_YEAR: 1.5,
  FOURTH_YEAR: 2.0,
};

class EnrollmentService {
  // ============ ENROLL ============
  enroll = async (req: Request, res: Response, next: NextFunction) => {
    const { courseId }: enrollSchemaType = req.body;
    const studentId = (req.user as any).id;

    // 1. ترم مفتوح؟
    const activeTerm = await prisma.term.findFirst({
      where: { isActive: true },
      include: { registrationWindows: true },
    });
    if (!activeTerm) throw new AppError("no active term, enrollment is closed", 400);

    // 2. الطالب موجود
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        studentGpa: true,
        department: { include: { courses: true } },
      },
    });
    if (!student) throw new AppError("student not found", 404);

    // 3. تحقق من نافذة التسجيل الخاصة بسنة الطالب
    const now = new Date();
    const studentWindow = activeTerm.registrationWindows.find(
      (w) => w.year === student.currentYear
    );

    if (!studentWindow) {
      throw new AppError(
        `no registration window configured for ${student.currentYear} in this term`,
        400
      );
    }

    if (now < studentWindow.startDate) {
      throw new AppError(
        `registration for ${student.currentYear} has not started yet, opens on ${studentWindow.startDate.toISOString()}`,
        400
      );
    }

    if (now > studentWindow.endDate) {
      throw new AppError(
        `registration deadline for ${student.currentYear} has passed (closed on ${studentWindow.endDate.toISOString()})`,
        400
      );
    }

    // 4. المادة موجودة + prerequisites
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { departments: true, prerequisites: true },
    });
    if (!course) throw new AppError("course not found", 404);

    // 5. المادة بتاعت قسم الطالب؟ (أو مادة عامة لو مفيش أقسام للمادة)
    if (course.departments.length > 0) {
      const courseInDept = course.departments.some((d) => d.id === student.departmentId);
      if (!courseInDept) {
        throw new AppError("course not available for your department", 403);
      }
    }

    // 6. السنة
    const studentYearNum = yearOrder[student.currentYear];
    const courseYearNum = yearOrder[course.yearNumber];
    if (courseYearNum > studentYearNum) {
      throw new AppError(
        `this course is for ${course.yearNumber}, you are in ${student.currentYear}`,
        400
      );
    }

    // 7. الـ GPA الأدنى للسنة
    const currentGpa = Number(student.studentGpa?.cumulativeGpa ?? 0);
    const requiredGpa = minGpaForYear[student.currentYear];
    if (currentGpa < requiredGpa) {
      throw new AppError(
        `your GPA ${currentGpa} is below the minimum ${requiredGpa} required for ${student.currentYear}`,
        400
      );
    }

    // 8. تحقق من الـ Prerequisites
    if (course.prerequisites.length > 0) {
      const passedEnrollments = await prisma.enrollment.findMany({
        where: {
          studentId,
          courseId: { in: course.prerequisites.map((p) => p.id) },
          status: "ENROLLED",
          grade: {
            letterGrade: { not: "F" },
            isLocked: true,
          },
        },
        select: { courseId: true },
      });

      const passedIds = passedEnrollments.map((e) => e.courseId);
      const missing = course.prerequisites.filter((p) => !passedIds.includes(p.id));

      if (missing.length > 0) {
        throw new AppError(
          `you must pass these courses first: ${missing.map((m) => m.courseCode).join(", ")}`,
          400
        );
      }
    }

    // 9. تحقق من الـ Credit Hours Limit
    const creditRule = await prisma.creditRule.findFirst({
      where: {
        minGpa: { lte: currentGpa },
        OR: [{ maxGpa: null }, { maxGpa: { gt: currentGpa } }],
      },
      orderBy: { minGpa: "desc" },
    });

    if (creditRule) {
      const currentTermEnrollments = await prisma.enrollment.findMany({
        where: { studentId, termId: activeTerm.id, status: "ENROLLED" },
        include: { course: { select: { creditHours: true } } },
      });

      const enrolledCredits = currentTermEnrollments.reduce(
        (sum, e) => sum + e.course.creditHours,
        0
      );

      if (enrolledCredits + course.creditHours > creditRule.maxCredits) {
        throw new AppError(
          `cannot exceed ${creditRule.maxCredits} credit hours (enrolled: ${enrolledCredits}, adding: ${course.creditHours})`,
          400
        );
      }
    }

    // 10. مش مسجلها قبل كده في نفس الترم
    const alreadyEnrolled = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId_termId: { studentId, courseId, termId: activeTerm.id },
      },
    });
    if (alreadyEnrolled) throw new AppError("already enrolled in this course", 409);

    // 11. ما عدش اجتازها قبل كده
    const passed = await prisma.enrollment.findFirst({
      where: {
        studentId,
        courseId,
        grade: { letterGrade: { not: "F" }, isLocked: true },
      },
    });
    if (passed) throw new AppError("you already passed this course", 400);

    const enrollment = await prisma.enrollment.create({
      data: { studentId, courseId, termId: activeTerm.id },
      include: { course: true, term: true },
    });

    return res.status(201).json({ message: "enrolled successfully", enrollment });
  };

  // ============ DROP COURSE ============
  dropCourse = async (req: Request, res: Response, next: NextFunction) => {
    const { enrollmentId } = req.params;
    const studentId = (req.user as any).id;

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId as string },
      include: { grade: true, term: { include: { registrationWindows: true } } },
    });

    if (!enrollment) throw new AppError("enrollment not found", 404);
    if (enrollment.studentId !== studentId) throw new AppError("forbidden", 403);
    if (!enrollment.term.isActive) throw new AppError("cannot drop after term is closed", 400);
    if (enrollment.grade?.isLocked) throw new AppError("grade is locked, cannot drop", 400);

    // تحقق ان نافذة التسجيل لسه مفتوحة
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    const now = new Date();
    const window = enrollment.term.registrationWindows.find(
      (w) => w.year === student?.currentYear
    );

    if (!window || now > window.endDate) {
      throw new AppError("registration window is closed, cannot drop course", 400);
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId as string },
      data: { status: "DROPPED" },
    });

    return res.status(200).json({ message: "course dropped", enrollment: updated });
  };

  // ============ GET MY ENROLLMENTS ============
  getMyEnrollments = async (req: Request, res: Response, next: NextFunction) => {
    const studentId = (req.user as any).id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { studentGpa: true },
    });

    const activeTerm = await prisma.term.findFirst({
      where: { isActive: true },
      include: { registrationWindows: true },
    });

    const enrollments = activeTerm
      ? await prisma.enrollment.findMany({
          where: { studentId, termId: activeTerm.id, status: "ENROLLED" },
          include: { course: true, grade: true },
        })
      : [];

    const totalCredits = enrollments.reduce((sum, e) => sum + e.course.creditHours, 0);

    // الـ credit rule الحالية
    const currentGpa = Number(student?.studentGpa?.cumulativeGpa ?? 0);
    const creditRule = await prisma.creditRule.findFirst({
      where: {
        minGpa: { lte: currentGpa },
        OR: [{ maxGpa: null }, { maxGpa: { gt: currentGpa } }],
      },
      orderBy: { minGpa: "desc" },
    });

    // حالة نافذة التسجيل للطالب
    const now = new Date();
    const studentWindow = activeTerm?.registrationWindows.find(
      (w) => w.year === student?.currentYear
    );

    const windowStatus = studentWindow
      ? {
          year: studentWindow.year,
          startDate: studentWindow.startDate,
          endDate: studentWindow.endDate,
          status:
            now < studentWindow.startDate
              ? "upcoming"
              : now > studentWindow.endDate
              ? "closed"
              : "open",
        }
      : null;

    return res.status(200).json({
      term: activeTerm
        ? `${activeTerm.academicYear} - ${activeTerm.semester}`
        : "no active term",
      registrationWindow: windowStatus,
      totalCredits,
      maxCredits: creditRule?.maxCredits ?? null,
      remainingCredits: creditRule ? creditRule.maxCredits - totalCredits : null,
      enrollments,
    });
  };

  // ============ GET ALL ENROLLMENTS (Admin) ============
  getAllEnrollments = async (req: Request, res: Response, next: NextFunction) => {
    const { termId, studentId } = req.query;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        ...(termId && { termId: termId as string }),
        ...(studentId && { studentId: studentId as string }),
      },
      include: {
        student: { select: { fullName: true, studentCode: true, currentYear: true } },
        course: true,
        term: true,
        grade: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ count: enrollments.length, enrollments });
  };
  // ============ GET AVAILABLE COURSES FOR STUDENT ============
  getAvailableCourses = async (req: Request, res: Response, next: NextFunction) => {
    const studentId = (req.user as any).id;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) throw new AppError("student not found", 404);

    // 1. جلب المواد التي نجح فيها الطالب بالفعل (أي تقدير غير F)
    const passedEnrollments = await prisma.enrollment.findMany({
      where: {
        studentId,
        grade: {
          isNot: { letterGrade: "F" }
        }
      },
      select: { courseId: true },
    });

    // 2. جلب المواد المسجلة في الترم النشط حالياً (حتى لا يسجلها مرتين)
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        studentId,
        term: { isActive: true }
      },
      select: { courseId: true },
    });

    const excludedCourseIds = [
      ...passedEnrollments.map((e) => e.courseId),
      ...activeEnrollments.map((e) => e.courseId)
    ];

    // 3. جلب المواد المتاحة
    const availableCourses = await prisma.course.findMany({
      where: {
        id: { notIn: excludedCourseIds },
        yearNumber: student.currentYear,
        OR: [
          { departments: { none: {} } }, // مواد عامة
          { departments: { some: { id: student.departmentId || "" } } }, // مواد قسمه
        ],
      },
      include: {
        departments: true,
        prerequisites: true,
      },
    });

    return res.status(200).json({
      count: availableCourses.length,
      courses: availableCourses,
    });
  };
}

export default new EnrollmentService();