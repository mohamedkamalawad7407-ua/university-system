# 🎓 University Management & Course Enrollment System (API Backend)

A robust, enterprise-grade university management and credit-hour system API built with **Node.js**, **Express.js**, **TypeScript**, and **Prisma ORM**, backed by a **PostgreSQL** database. 

This backend system implements high-fidelity business logic for managing students, academic courses, department assignments, multi-semester terms, grade management (with automatic GPA calculations), and a highly-constrained course enrollment engine that respects pre-requisites, GPA thresholds, and dynamically-assigned credit limits.

---

## 🚀 Technology Stack

- **Runtime & Framework**: Node.js, Express.js
- **Programming Language**: TypeScript (strict type compliance, highly scalable design)
- **Database ORM**: Prisma ORM with native transactional consistency
- **Database**: PostgreSQL (relational storage with optimized indexes and cascade strategies)
- **Data Validation & Parsing**: Zod (runtime type checking & body validation)
- **Security & JWT Auth**: JSON Web Tokens (JWT), Bcrypt password hashing, authorization guards
- **Bulk Operations**: Multer (file buffers) & PDF text parsing for student/grade bulk imports
- **API Guarding**: Helmet (header protection), CORS, Express Rate Limit (DDoS mitigation)

---

## 📂 Project Architecture

The codebase follows an elegant, domain-driven **Module-Based Structure** where each functional boundary is isolated into its own folder (holding its controller, service, and Zod validator).

```text
src/
├── middleware/       # Global filters (Auth guards, Schema validators, Error boundaries)
├── utils/            # Shared utilities (Custom AppError handler, JWT & Signature generators)
└── moudles/          # Isolated, domain-driven business modules
    ├── admin/        # System Administrators authentication and management
    ├── student/      # Students credentials, profile compilation, and PDF bulk creation
    ├── Department/   # Department capacity constraints, minimum GPAs, & stats engine
    ├── Course/       # Academic course definitions, prerequisites, & department bindings
    ├── Term/         # Dynamic terms (Active Term, Semester types, Year-based Registration Windows)
    ├── Enrollment/   # The core constraints engine (enrollment rules, availability queries)
    ├── Grade/        # Grade publishing, letter grade mapping, automatic term & cumulative GPA logic
    ├── Gradescale/   # Grading scales (Score range to GPA points & letter grade mapping)
    ├── Creditrule/   # Dynamic credit constraints based on GPA and student status (New vs. Enrolled)
    └── Promotion/    # Automated year-to-year promotion rules based on passed credit hours
```

---

## 🗄️ Database Architecture & Entity Relationships

The relational model utilizes PostgreSQL schema bindings through Prisma, enforcing data integrity and cascading behavior.

```mermaid
erDiagram
    ADMIN {
        string id PK
        string email UK
        string password
        datetime createdAt
    }
    STUDENT {
        string id PK
        string studentCode UK
        string nationalId UK
        string fullName
        StudyYear currentYear
        decimal gpa
        string departmentId FK
        datetime createdAt
    }
    DEPARTMENT {
        string id PK
        string name UK
        int maxStudents
        decimal minGpa
    }
    COURSE {
        string id PK
        string name
        string courseCode UK
        int creditHours
        StudyYear yearNumber
    }
    TERM {
        string id PK
        string academicYear
        Semester semester
        boolean isActive
        boolean isGradesPublished
        datetime appealsEndDate
    }
    REGISTRATION_WINDOW {
        string id PK
        string termId FK
        StudyYear year
        datetime startDate
        datetime endDate
    }
    ENROLLMENT {
        string id PK
        string studentId FK
        string courseId FK
        string termId FK
        EnrollmentStatus status
        datetime createdAt
    }
    GRADE {
        string id PK
        string enrollmentId FK
        string letterGrade
        int score
        decimal gpaPoints
        boolean isLocked
    }
    TERM_GPA {
        string id PK
        string studentId FK
        string termId FK
        decimal gpa
        int totalCredits
    }
    STUDENT_GPA {
        string id PK
        string studentId FK
        decimal cumulativeGpa
        int totalCredits
    }
    CREDIT_RULE {
        string id PK
        decimal minGpa
        decimal maxGpa
        int maxCredits
        boolean isForNewStudents
    }
    PROMOTION_RULE {
        string id PK
        StudyYear fromYear UK
        int minCredits
    }

    DEPARTMENT ||--o{ STUDENT : "enrolls"
    STUDENT ||--o{ ENROLLMENT : "creates"
    STUDENT ||--o{ TERM_GPA : "records"
    STUDENT ||--o| STUDENT_GPA : "maintains"
    TERM ||--o{ REGISTRATION_WINDOW : "defines"
    TERM ||--o{ ENROLLMENT : "hosts"
    COURSE ||--o{ ENROLLMENT : "targets"
    ENROLLMENT ||--o| GRADE : "earns"
    COURSE }|..|{ DEPARTMENT : "belongs_to"
```

---

## 💡 Detailed Feature Breakdowns

### 1. Robust Authentication & Roles
- **Dual-Role Guards**: The system enforces discrete `admin` and `student` roles.
- **Student Onboarding Credentials**: Students log in using their `studentCode` and `nationalId` as primary credentials, bypassing traditional password requirements for academic security.
- **Admin Accounts**: Protected by Bcrypt hashing with absolute API security.

### 2. Smart Department Allocation
- **Academic Enforcements**: Assigning a student to a department checks if the department has reached its `maxStudents` capacity.
- **GPA Prerequisite Check**: Prevents students from joining highly competitive departments unless their cumulative GPA is higher than the department's configured `minGpa` (exempting fresh first-year students).
- **Yearly Student Analytics**: Provides deep reporting on student distribution per academic year (FIRST_YEAR through FOURTH_YEAR) and average GPAs across the department.

### 3. Credit Hour Limit Constraints (`CreditRules`)
- **GPA-based Capacities**: Dynamically configures the maximum credit hours a student is allowed to register per term based on their cumulative GPA.
- **Freshmen Safe-Guards**: Custom configuration rules (`isForNewStudents = true`) apply specifically to first-year students who do not yet have a recorded GPA.

### 4. Rigid Multi-Semester Terms & Registration Windows
- **Active Term Control**: Allows only one term (First, Second, or Summer) to be set to `isActive` at any given time.
- **Registration Timeframes**: Defines specific date windows (`startDate` to `endDate`) per academic year (e.g. registration opens for Seniors on Monday, Juniors on Tuesday) to manage server demand.
- **Term Courses**: Administrators dynamically select and configure which courses are offered in the active term (`TermCourse`).

### 5. Advanced Enrollment constraints Engine (`getAvailableCourses`)
The course enrollment core performs strict multi-variable validation checks before approving a student registration:
- **Offered Checks**: Ensures the course is actively offered in the current term.
- **Prerequisite Validation**: Students must have already completed and **passed** all prerequisites (grade $\neq$ 'F') before registering.
- **Department Boundaries**: Enforces that department-specific courses are only joinable by declared students.
- **Level Restrictions**: Restricts students from registering for higher-level courses (e.g., a Sophomore cannot take a Senior course) unless they advance in academic years.
- **Double-Pass Guard**: Blocks registration for any course the student has already passed in a previous semester.
- **Credit Hour Bounds**: Dynamically validates the student's registered hours against their maximum allowed credits (based on `CreditRules`) to prevent over-enrollment.
- **Automatic Retake Identification**: Identifies failed courses (letter grade `'F'`) and displays them separately to encourage retaking.

### 6. Intelligent Grades & Automatic GPA calculations
- **Automated Conversions**: Raw numerical grades (out of 100) are automatically mapped to Letter Grades (`A`, `B+`, `C-`, `F`, etc.) using dynamic mappings defined in the `GradeScale` table.
- **Grade Locking**: Administrators audit and "Lock" grades. Once locked, grades cannot be modified, triggering a cascading, transactional calculation of:
  - The student's current Term GPA.
  - The student's overall Cumulative GPA.
  - The student's total completed Credit Hours.
- **Bulk PDF Import**: Supports uploading bulk student grades and bulk student accounts by reading and parsing tables directly from standard academic PDF reports.

### 7. Academic Advancement (`PromotionRules`)
- **Automatic Level-Up**: Runs background validation rules evaluating student progress. If the student has successfully passed the minimum credit hours defined in `PromotionRules` for their current `StudyYear`, they are automatically promoted to the next academic level.

---

## 🛠️ Installation & Server Setup

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **PostgreSQL** database instance
- **npm** (v9+)

### 2. Environment Configurations
Create a `.env` file in the root directory and populate it with your environment-specific credentials:

```ini
PORT=5000
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/university_db?schema=public"
JWT_SECRET="YOUR_SUPER_SECURE_JWT_SECRET_KEY"
```

### 3. Installation Steps
Execute the following commands to install dependencies, run migrations, and launch the server:

```bash
# 1. Install project dependencies
npm install

# 2. Sync database schema using Prisma
npx prisma generate
npx prisma db push

# 3. Compile and run the TypeScript backend in development mode
npm run start:dev
```

---

## 📝 API Integration & Lifecycle Workflows

To successfully configure and test the university API ecosystem, administrators and client developers should follow this sequential workflow:

```mermaid
graph TD
    A[1. Seed System Configuration] --> B[2. Configure Rules]
    B --> C[3. Setup Academic Structure]
    C --> D[4. Populate Student Accounts]
    D --> E[5. Setup Active Term]
    E --> F[6. Student Course Registration]
    F --> G[7. Input & Lock Grades]
    G --> H[8. Automatic GPA & Promotion Calculations]

    style A fill:#4CAF50,stroke:#388E3C,color:#fff
    style H fill:#2196F3,stroke:#1976D2,color:#fff
```

1. **System Config**: Seed the `GradeScale` database (e.g., mapping scores 90-100 to letter grade `A`, points `4.00`).
2. **Setup Rules**: Define `CreditRules` (GPA to maximum credits allowed) and `PromotionRules` (credits required to move to next year).
3. **Academic Structure**: Create `Department` records and register `Course` listings (including prerequisite definitions).
4. **Student Registry**: Upload students individually or use the Bulk PDF Upload endpoint (`/student/bulk`) using academic registry PDFs.
5. **Term Startup**: Create a new `Term` record, mark it as `isActive`, add offered courses to this term, and set `RegistrationWindow` dates for each student year.
6. **Enrollment**: Students log in, check available courses using `/enrollment/available` (which computes academic eligibility), and post enrollments.
7. **Grades Processing**: Post term marks (individually or bulk), audit the scores, and call `/grade/lock` to finalize grades.
8. **Advancement**: The locking process cascades to update `StudentGpa` dynamically, calculating GPAs and advancing eligible students to higher levels.

---
*Developed as a highly secure, reliable, and scalable core for modern university portals.*
