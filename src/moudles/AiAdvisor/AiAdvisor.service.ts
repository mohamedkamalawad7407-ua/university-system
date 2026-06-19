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

    // 3. Fetch active enrollments in the active term with prerequisite dependencies
    const activeEnrollments = await prisma.enrollment.findMany({
      where: {
        studentId: studentId,
        termId: activeTerm.id,
        status: "ENROLLED",
      },
      include: {
        course: {
          include: {
            requiredFor: true,
          },
        },
      },
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

    // Format prerequisite dependencies warning info
    const dependenciesList = activeEnrollments
      .filter((e) => e.course.requiredFor && e.course.requiredFor.length > 0)
      .map((e) => {
        const dependentNames = e.course.requiredFor
          .map((dep) => `${dep.name} (${dep.courseCode})`)
          .join(", ");
        return `- ${e.course.name} (${e.course.courseCode}): معتمد عليها مواد مستقبلاً: ${dependentNames}`;
      })
      .join("\n");

    // Format grade scale rules for prompt
    const gradeScaleRules = gradeScales
      .map(
        (s: any) =>
          `- Letter Grade: ${s.letterGrade}, Score Range: ${s.minScore}-${s.maxScore}, GPA Points: ${s.gpaPoints}`
      )
      .join("\n");

    const prompt = `
You are a friendly, encouraging academic AI advisor. A student wants to reach a cumulative GPA of ${targetGpa}.

Student Profile:
- Name: ${student.fullName}
- Current GPA: ${currentGpa}
- Current Completed Credits: ${currentCredits}
- Target GPA: ${targetGpa}

Current Semester Enrolled Courses:
${activeCoursesList}

Grading Scale:
${gradeScaleRules}

Prerequisite Dependencies (Subsequent courses that depend on the student's current courses):
${dependenciesList || "None"}

Mathematical Data:
- Total Credits after this semester: ${totalFutureCredits}
- Current Total Points: ${currentWeightedPoints.toFixed(2)}
- Target Total Points: ${targetWeightedPoints.toFixed(2)}
- Additional points needed from active courses: ${neededPoints.toFixed(2)}
- Max Possible cumulative GPA they can reach this semester: ${roundedMaxPossibleGpa}

Write a simplified, neat, and direct response in Arabic. Do NOT make it overly complex or verbose. Keep it friendly and practical.
Use this structure:
1. **التحليل والجدوى (هل الهدف ممكن؟)**:
   - State clearly if it's achievable this semester.
   - If achievable: say "نعم، الهدف ممكن!" and explain if it's easy or requires high grades.
   - If not achievable: say "للأسف، الهدف غير ممكن رياضياً هذا الفصل" and mention the maximum GPA they can reach (${roundedMaxPossibleGpa}) if they get full marks. Encourage them to target that first.
   - Keep the explanation very brief and avoid writing long formulas.

2. **التقديرات المطلوبة في المواد الحالية (Target Grades)**:
   - For EACH current course, suggest the target grade and score they need to aim for to secure the target (or the max possible if target is not feasible).
   - Use a simple and neat format (e.g., a simple bullet point list or a small markdown table).

3. **تحذير بشأن المتطلبات السابقة (Prerequisite Warnings)**:
   - Check if there are future courses dependent on their current courses (listed in Prerequisite Dependencies).
   - If yes, write a clear warning section in Arabic (e.g., "⚠️ تحذير متطلبات هامة:") informing the student that failing or dropping these courses will block them from registering for those dependent courses in subsequent semesters. List them clearly.
   - If there are no dependencies, you can skip this section or state there are no dependencies affected.

4. **نصائح سريعة للنجاح (3 Quick Tips)**:
   - Give exactly 3 brief, actionable tips to succeed in these courses.
`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
