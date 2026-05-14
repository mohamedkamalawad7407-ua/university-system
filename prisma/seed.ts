// import { PrismaClient, StudyYear, Semester, EnrollmentStatus } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('Cleaning up database...');
//   await prisma.grade.deleteMany();
//   await prisma.termGpa.deleteMany();
//   await prisma.studentGpa.deleteMany();
//   await prisma.enrollment.deleteMany();
//   await prisma.termCourse.deleteMany();
//   await prisma.registrationWindow.deleteMany();
//   await prisma.term.deleteMany();
//   await prisma.student.deleteMany();
//   await prisma.course.deleteMany();
//   await prisma.department.deleteMany();
//   await prisma.creditRule.deleteMany();
//   await prisma.promotionRule.deleteMany();
//   await prisma.gradeScale.deleteMany();

//   console.log('Seeding departments...');
//   const csDept = await prisma.department.create({
//     data: { name: 'Computer Science', maxStudents: 200, minGpa: 2.0 }
//   });
//   const isDept = await prisma.department.create({
//     data: { name: 'Information Systems', maxStudents: 200, minGpa: 1.8 }
//   });

//   console.log('Seeding grade scales...');
//   await prisma.gradeScale.createMany({
//     data: [
//       { letterGrade: 'A+', minScore: 97, maxScore: 100, gpaPoints: 4.0 },
//       { letterGrade: 'A', minScore: 93, maxScore: 96, gpaPoints: 4.0 },
//       { letterGrade: 'A-', minScore: 89, maxScore: 92, gpaPoints: 3.7 },
//       { letterGrade: 'B+', minScore: 84, maxScore: 88, gpaPoints: 3.3 },
//       { letterGrade: 'B', minScore: 80, maxScore: 83, gpaPoints: 3.0 },
//       { letterGrade: 'C+', minScore: 74, maxScore: 79, gpaPoints: 2.3 },
//       { letterGrade: 'C', minScore: 70, maxScore: 73, gpaPoints: 2.0 },
//       { letterGrade: 'D+', minScore: 64, maxScore: 69, gpaPoints: 1.3 },
//       { letterGrade: 'D', minScore: 60, maxScore: 63, gpaPoints: 1.0 },
//       { letterGrade: 'F', minScore: 0, maxScore: 59, gpaPoints: 0.0 },
//     ]
//   });

//   console.log('Seeding credit rules...');
//   await prisma.creditRule.createMany({
//     data: [
//       { minGpa: 0.0, maxGpa: 4.0, maxCredits: 12, isForNewStudents: true },
//       { minGpa: 0.0, maxGpa: 1.99, maxCredits: 12, isForNewStudents: false },
//       { minGpa: 2.0, maxGpa: 2.99, maxCredits: 18, isForNewStudents: false },
//       { minGpa: 3.0, maxGpa: 4.0, maxCredits: 21, isForNewStudents: false },
//     ]
//   });

//   console.log('Seeding promotion rules...');
//   await prisma.promotionRule.createMany({
//     data: [
//       { fromYear: 'FIRST_YEAR', minCredits: 30 },
//       { fromYear: 'SECOND_YEAR', minCredits: 60 },
//       { fromYear: 'THIRD_YEAR', minCredits: 90 },
//     ]
//   });

//   console.log('Seeding courses...');
//   const years: StudyYear[] = ['FIRST_YEAR', 'SECOND_YEAR', 'THIRD_YEAR', 'FOURTH_YEAR'];
//   const coursesByYear: Record<StudyYear, any[]> = {
//     FIRST_YEAR: [],
//     SECOND_YEAR: [],
//     THIRD_YEAR: [],
//     FOURTH_YEAR: []
//   };
  
//   for (const year of years) {
//     for (let i = 1; i <= 10; i++) {
//       const yearPrefix = year === 'FIRST_YEAR' ? '1' : year === 'SECOND_YEAR' ? '2' : year === 'THIRD_YEAR' ? '3' : '4';
//       const c = await prisma.course.create({
//         data: {
//           name: `${year} Course ${i}`,
//           courseCode: `C${yearPrefix}0${i}`,
//           creditHours: 3,
//           yearNumber: year,
//           departments: { connect: [{ id: csDept.id }, { id: isDept.id }] }
//         }
//       });
//       coursesByYear[year].push(c);
//     }
//   }

//   console.log('Seeding terms...');
//   const pastTerms = [];
//   for (let y = 2021; y <= 2024; y++) {
//     const t1 = await prisma.term.create({
//       data: { academicYear: `${y}/${y+1}`, semester: 'FIRST', isActive: false }
//     });
//     const t2 = await prisma.term.create({
//       data: { academicYear: `${y}/${y+1}`, semester: 'SECOND', isActive: false }
//     });
//     pastTerms.push(t1, t2);
//   }

//   const activeTerm = await prisma.term.create({
//     data: { academicYear: '2025/2026', semester: 'FIRST', isActive: true }
//   });

//   console.log('Seeding term courses for active term...');
//   for (const year of years) {
//     for (const course of coursesByYear[year]) {
//       await prisma.termCourse.create({
//         data: { termId: activeTerm.id, courseId: course.id }
//       });
//     }
//   }

//   console.log('Seeding registration windows...');
//   await prisma.registrationWindow.createMany({
//     data: years.map(year => ({
//       termId: activeTerm.id,
//       year,
//       startDate: new Date('2025-01-01'),
//       endDate: new Date('2026-12-31'),
//     }))
//   });

//   console.log('Seeding students and their history...');
//   let studentCount = 0;
//   for (const year of years) {
//     const yearIdx = years.indexOf(year);
//     for (let i = 1; i <= 5; i++) {
//       studentCount++;
//       const student = await prisma.student.create({
//         data: {
//           fullName: `Student ${studentCount} - ${year}`,
//           studentCode: `STU${String(studentCount).padStart(3, '0')}`,
//           nationalId: `NationalID${studentCount}${year}`,
//           currentYear: year,
//           departmentId: i % 2 === 0 ? csDept.id : isDept.id,
//         }
//       });

//       let totalPoints = 0;
//       let totalHours = 0;
//       let passedCredits = 0;

//       // Seed history for previous years
//       for (let prevYearIdx = 0; prevYearIdx < yearIdx; prevYearIdx++) {
//         const prevYear = years[prevYearIdx]!;
//         const term = pastTerms[prevYearIdx * 2]!; // Use first semester of that year
        
//         for (let cIdx = 0; cIdx < 5; cIdx++) {
//           const course = coursesByYear[prevYear]![cIdx]!;
//           const enrollment = await prisma.enrollment.create({
//             data: {
//               studentId: student.id,
//               courseId: course.id,
//               termId: term.id,
//               status: 'ENROLLED',
//             }
//           });

//           const isF = i === 1 && cIdx === 0; // First student of each group fails one course
//           const grade = isF ? 'F' : 'B';
//           const points = isF ? 0.0 : 3.0;
//           const score = isF ? 50 : 80;

//           await prisma.grade.create({
//             data: {
//               enrollmentId: enrollment.id,
//               letterGrade: grade,
//               score: score,
//               gpaPoints: points,
//               isLocked: true
//             }
//           });

//           totalPoints += points * course.creditHours;
//           totalHours += course.creditHours;
//           if (!isF) passedCredits += course.creditHours;
//         }
//       }

//       // Seed current term enrollments
//       // If student failed a course in history, enroll them in it now (retake)
//       if (yearIdx > 0 && i === 1) {
//         const failedCourse = coursesByYear[years[0]!]![0]!;
//         await prisma.enrollment.create({
//           data: {
//             studentId: student.id,
//             courseId: failedCourse.id,
//             termId: activeTerm.id,
//             status: 'ENROLLED',
//           }
//         });
//       }

//       // Enroll in current year courses
//       const currentYearCourses = coursesByYear[year].slice(0, 4);
//       for (const course of currentYearCourses) {
//         await prisma.enrollment.create({
//           data: {
//             studentId: student.id,
//             courseId: course.id,
//             termId: activeTerm.id,
//             status: 'ENROLLED',
//           }
//         });
//       }

//       // Create GPA record if they have history
//       if (totalHours > 0) {
//         await prisma.studentGpa.create({
//           data: {
//             studentId: student.id,
//             cumulativeGpa: totalPoints / totalHours,
//             totalCredits: passedCredits
//           }
//         });
//       }
//     }
//   }

//   console.log('Seed completed successfully!');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
