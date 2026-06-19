import { NextFunction, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../../utils/prisma";
import { AppError } from "../../utils/classError";
import { gpaTargetSchemaType } from "./AiAdvisor.validation";

// Initialize Gemini SDK (user needs to add GEMINI_API_KEY to their .env file)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

class AiAdvisorService {
  planGpaTarget = async (req: Request, res: Response, next: NextFunction) => {
    const studentId = (req.user as any).id;
    const { targetGpa }: gpaTargetSchemaType = req.body;

    if (!process.env.GEMINI_API_KEY) {
      throw new AppError("Gemini API key is not configured in the server environment (.env)", 500);
    }

    // 1. Fetch student data with GPA
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { studentGpa: true },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // 2. Fetch the active term
    const activeTerm = await prisma.term.findFirst({
      where: { isActive: true },
    });

    if (!activeTerm) {
      throw new AppError("There is no active academic term at the moment.", 400);
    }

    // 3. Fetch active enrollments in the active term
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        studentId: studentId,
        termId: activeTerm.id,
        status: "ENROLLED",
      },
      include: { course: true },
    });

    if (activeEnrollments.length === 0) {
      throw new AppError("You are not enrolled in any courses in the active term.", 400);
    }

    // 4. Fetch grade scales from the database
    const gradeScales = await prisma.gradeScale.findMany({
      orderBy: { gpaPoints: "desc" },
    });

    if (gradeScales.length === 0) {
      throw new AppError("No grade scales configured in the system.", 500);
    }

    // Find the maximum GPA points possible in the scale (usually A or A+)
    const maxScalePoints = Math.max(...gradeScales.map((s: any) => Number(s.gpaPoints)));

    // 5. Calculate GPA math
    const currentGpa = Number(student.studentGpa?.cumulativeGpa ?? 0.0);
    const currentCredits = student.studentGpa?.totalCredits ?? 0;
    
    const activeCredits = activeEnrollments.reduce(
      (sum, e) => sum + e.course.creditHours,
      0
    );

    const totalFutureCredits = currentCredits + activeCredits;
    const currentWeightedPoints = currentGpa * currentCredits;
    const targetWeightedPoints = targetGpa * totalFutureCredits;
    
    // Additional grade points needed from active courses
    const neededPoints = Math.max(0, targetWeightedPoints - currentWeightedPoints);
    const avgNeededPoints = activeCredits > 0 ? neededPoints / activeCredits : 0;

    // Calculate maximum possible GPA if student gets the max grade in all active courses
    const maxPossibleGpa = (currentWeightedPoints + (maxScalePoints * activeCredits)) / totalFutureCredits;
    const roundedMaxPossibleGpa = Math.round(maxPossibleGpa * 100) / 100;

    // Format active courses list for prompt
    const activeCoursesList = activeEnrollments
      .map(
        (e) =>
          `- Course Code: ${e.course.courseCode}, Course Name: ${e.course.name}, Credit Hours: ${e.course.creditHours}`
      )
      .join("\n");

    // Format grade scale rules for prompt
    const gradeScaleRules = gradeScales
      .map(
        (s: any) =>
          `- Letter Grade: ${s.letterGrade}, Score Range: ${s.minScore}-${s.maxScore}, GPA Points: ${s.gpaPoints}`
      )
      .join("\n");

    const prompt = `
You are an advanced academic AI advisor for a university management system.
A student wants to achieve a target cumulative GPA of ${targetGpa}.

Here is the student's academic profile:
- Student Name: ${student.fullName}
- Current Cumulative GPA: ${currentGpa}
- Current Completed Credits: ${currentCredits}
- Target Cumulative GPA: ${targetGpa}

Here are the courses they are currently enrolled in for this semester (active term):
${activeCoursesList}

Here is the university's grading scale (GradeScale):
${gradeScaleRules}

Here are the mathematical calculations:
- Total credit hours after this semester: ${totalFutureCredits}
- Current total grade points: ${currentWeightedPoints.toFixed(2)}
- Target total grade points needed: ${targetWeightedPoints.toFixed(2)}
- Additional grade points needed from active courses: ${neededPoints.toFixed(2)}
- Average GPA points needed per credit hour in active courses: ${avgNeededPoints.toFixed(2)} (Maximum possible in scale is ${maxScalePoints})
- Maximum possible cumulative GPA the student can achieve if they get the maximum grade in all current courses: ${roundedMaxPossibleGpa}

Your task is to analyze this data and generate a detailed, encouraging, and highly specific study plan/advising report in Arabic.
Please include the following sections:
1. **تحليل إمكانية التحقيق (Feasibility Analysis)**:
   - Tell the student if their target GPA of ${targetGpa} is mathematically achievable this semester.
   - If achievable, explain how realistic it is (e.g. requires moderate effort, high effort, or perfect grades).
   - If NOT achievable (because the needed average GPA points per credit hour is greater than ${maxScalePoints}), clearly explain that it is mathematically impossible to reach ${targetGpa} this semester. Provide the maximum GPA they can achieve (${roundedMaxPossibleGpa}) if they get full marks, and encourage them to aim for that as a stepping stone.

2. **توزيع التقديرات المستهدفة (Target Grades Distribution)**:
   - Suggest a specific target letter grade (e.g. A, B, C) and score range from the GradeScale for EACH active course so that the total GPA points they earn meets or exceeds the needed ${neededPoints.toFixed(2)} points.
   - For example: "Course X (3 Credits): Target Grade B (GPA Points 3.0), Course Y (2 Credits)... Total points = (3*3) + ... = 9+... which satisfies the needed points."
   - Make sure your suggested grades are realistic and add up to at least the required points.

3. **نصائح دراسية مخصصة (Custom Study Advice)**:
   - Provide concrete, helpful study advice in Arabic tailored for university students to help them achieve these target grades.
   - Offer tips on time management, consulting professors, preparing for exams, and peer study groups.

Keep the response structured, clear, using markdown formatting (bolding, lists, tables if appropriate) in professional, motivating Arabic.
`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      return res.status(200).json({
        message: "AI advising plan generated successfully",
        data: {
          currentGpa,
          currentCredits,
          targetGpa,
          activeCredits,
          maxPossibleGpa: roundedMaxPossibleGpa,
          isFeasible: avgNeededPoints <= maxScalePoints,
          neededPointsFromActive: Number(neededPoints.toFixed(2)),
          avgNeededPointsPerCredit: Number(avgNeededPoints.toFixed(2)),
          plan: responseText,
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to call Gemini AI API: ${error.message}`, 500);
    }
  };
}

export default new AiAdvisorService();
