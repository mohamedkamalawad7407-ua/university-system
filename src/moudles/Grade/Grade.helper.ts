import { LetterGrade } from "@prisma/client";

// بيجيب الـ letter grade والـ GPA points من الـ GradeScale بناءً على الدرجة الرقمية
export const resolveGradeFromScale = async (
  score: number,
  prisma: any
): Promise<{ letterGrade: LetterGrade; gpaPoints: number }> => {
  const scale = await prisma.gradeScale.findFirst({
    where: {
      minScore: { lte: score },
      maxScore: { gte: score },
    },
  });

  if (!scale) {
    throw new Error(
      `no grade scale found for score ${score}, please configure grade scales first`
    );
  }

  return {
    letterGrade: scale.letterGrade,
    gpaPoints: Number(scale.gpaPoints),
  };
};

// حساب الـ GPA = مجموع (النقاط × الساعات) / مجموع الساعات
export const calculateGpa = (
  courses: { gpaPoints: number; creditHours: number }[]
): number => {
  const totalCredits = courses.reduce((sum, c) => sum + c.creditHours, 0);
  if (totalCredits === 0) return 0;

  const weightedSum = courses.reduce(
    (sum, c) => sum + c.gpaPoints * c.creditHours,
    0
  );

  return Math.round((weightedSum / totalCredits) * 100) / 100;
};