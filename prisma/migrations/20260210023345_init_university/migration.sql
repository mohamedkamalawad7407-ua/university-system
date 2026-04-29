-- CreateEnum
CREATE TYPE "StudyYear" AS ENUM ('FIRST_YEAR', 'SECOND_YEAR', 'THIRD_YEAR', 'FOURTH_YEAR');

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('FIRST', 'SECOND', 'SUMMER');

-- CreateEnum
CREATE TYPE "LetterGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'DROPPED');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "max_students" INTEGER NOT NULL,
    "min_gpa" DECIMAL(4,2) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "student_code" TEXT NOT NULL,
    "national_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "current_year" "StudyYear" NOT NULL,
    "gpa" DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "department_id" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "credit_hours" INTEGER NOT NULL,
    "year_number" "StudyYear" NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "semester" "Semester" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "letter_grade" "LetterGrade" NOT NULL,
    "gpa_points" DECIMAL(4,2) NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term_gpa" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "gpa" DECIMAL(4,2) NOT NULL,
    "total_credits" INTEGER NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_gpa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_gpa" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "cumulative_gpa" DECIMAL(4,2) NOT NULL,
    "total_credits" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_gpa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CourseToDepartment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CourseToDepartment_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_department_key" ON "Department"("department");

-- CreateIndex
CREATE UNIQUE INDEX "Student_student_code_key" ON "Student"("student_code");

-- CreateIndex
CREATE UNIQUE INDEX "Student_national_id_key" ON "Student"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Course_course_code_key" ON "Course"("course_code");

-- CreateIndex
CREATE UNIQUE INDEX "Term_academic_year_semester_key" ON "Term"("academic_year", "semester");

-- CreateIndex
CREATE INDEX "Enrollment_student_id_idx" ON "Enrollment"("student_id");

-- CreateIndex
CREATE INDEX "Enrollment_course_id_idx" ON "Enrollment"("course_id");

-- CreateIndex
CREATE INDEX "Enrollment_term_id_idx" ON "Enrollment"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_student_id_course_id_term_id_key" ON "Enrollment"("student_id", "course_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "grades_enrollment_id_key" ON "grades"("enrollment_id");

-- CreateIndex
CREATE INDEX "grades_letter_grade_idx" ON "grades"("letter_grade");

-- CreateIndex
CREATE INDEX "term_gpa_term_id_idx" ON "term_gpa"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_gpa_student_id_term_id_key" ON "term_gpa"("student_id", "term_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_gpa_student_id_key" ON "student_gpa"("student_id");

-- CreateIndex
CREATE INDEX "_CourseToDepartment_B_index" ON "_CourseToDepartment"("B");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_gpa" ADD CONSTRAINT "term_gpa_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_gpa" ADD CONSTRAINT "term_gpa_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_gpa" ADD CONSTRAINT "student_gpa_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseToDepartment" ADD CONSTRAINT "_CourseToDepartment_A_fkey" FOREIGN KEY ("A") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CourseToDepartment" ADD CONSTRAINT "_CourseToDepartment_B_fkey" FOREIGN KEY ("B") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
