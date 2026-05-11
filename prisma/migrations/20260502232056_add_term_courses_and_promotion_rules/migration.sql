/*
  Warnings:

  - Added the required column `name` to the `Course` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score` to the `grades` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `letter_grade` on the `grades` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "grades" ADD COLUMN     "score" INTEGER NOT NULL,
DROP COLUMN "letter_grade",
ADD COLUMN     "letter_grade" TEXT NOT NULL;

-- DropEnum
DROP TYPE "LetterGrade";

-- CreateTable
CREATE TABLE "GradeScale" (
    "letterGrade" TEXT NOT NULL,
    "minScore" DECIMAL(65,30) NOT NULL,
    "maxScore" DECIMAL(65,30) NOT NULL,
    "gpaPoints" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "GradeScale_pkey" PRIMARY KEY ("letterGrade")
);

-- CreateTable
CREATE TABLE "term_courses" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,

    CONSTRAINT "term_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_rules" (
    "id" TEXT NOT NULL,
    "from_year" "StudyYear" NOT NULL,
    "min_credits" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "term_courses_term_id_course_id_key" ON "term_courses"("term_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_rules_from_year_key" ON "promotion_rules"("from_year");

-- CreateIndex
CREATE INDEX "grades_letter_grade_idx" ON "grades"("letter_grade");

-- AddForeignKey
ALTER TABLE "term_courses" ADD CONSTRAINT "term_courses_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term_courses" ADD CONSTRAINT "term_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
