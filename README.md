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
- **Bulk Operations**: Multer (file buffers) & PDF text parsing (`pdf-parse`) for student bulk imports, and CSV parser for grades bulk imports
- **AI Integration**: Google Gen AI SDK (Gemini 2.5 Flash) for personalized academic advisory
- **API Guarding**: Helmet (header protection), CORS, Express Rate Limit (DDoS mitigation)

---

## 📂 Project Architecture

The codebase follows an elegant, domain-driven **Module-Based Structure** where each functional boundary is isolated into its own folder (holding its controller, service, and Zod validator).

```text
src/
├── middleware/       # Global filters (Auth guards, Schema validators, Error boundaries)
│   ├── authentication.ts  # Decodes JWT tokens and fetches users
│   ├── authorization.ts   # Enforces access control based on user roles
│   └── validation.ts      # Performs Zod validation on request data
├── utils/            # Shared utilities (Custom AppError handler, JWT & Signature generators)
│   ├── classError.ts      # AppError extending Error class
│   ├── hash.ts            # Bcrypt hashing helper
│   ├── prisma.ts          # Central Prisma Client instance
│   ├── request.type.ts    # Global typing overrides for Express Request
│   └── token.ts           # Token generation/verification and signature retrieval
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
    ├── Promotion/    # Automated year-to-year promotion rules based on passed credit hours
    └── AiAdvisor/    # AI-powered target GPA planner using Gemini
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
        boolean isLocked
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
    GRADE_SCALE {
        string letterGrade PK
        decimal minScore
        decimal maxScore
        decimal gpaPoints
    }
    TERM_COURSE {
        string id PK
        string termId FK
        string courseId FK
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
    TERM ||--o{ TERM_COURSE : "contains"
    COURSE ||--o{ TERM_COURSE : "offered_in"
```

---

## 🛠️ Global Middleware & Custom Utilities

### 1. Security & Guards Middleware
*   **Authentication (`authentication.ts`)**: Extends express request contexts. Reads JWT tokens from the `Authorization` header (`Bearer <token>`), verifies the signature against token configurations (Access/Refresh), decodes payload `{ id, role }`, retrieves the matching database user (Admin or Student), and appends it to `req.user`.
*   **Authorization (`authorization.ts`)**: Takes a parameter list of allowed roles (e.g., `admin`, `student`). Compares the user role inside `req.user` and throws a `403 Forbidden` error if the role is unauthorized.
*   **Validation (`validation.ts`)**: Generic validation wrapper for Zod schemas. Supports validating `body`, `query`, or `params` and aggregates formatting errors before forwarding them to the global exception filter.

### 2. General Utilities
*   **Token Controller (`token.ts`)**: Manages JWT operations. Resolves corresponding environment signatures (e.g. `ACCESS_TOKEN`, `REFRESH_TOKEN`) and encapsulates sign/verify actions.
*   **Encryption Provider (`hash.ts`)**: Encapsulates `bcrypt` utilities with salt-round configurations from system environment variables.
*   **Global Exception Boundaries**: Catch-all Express middleware converting standard Node exceptions and `AppError` payloads into standard JSON responses holding the HTTP status code, descriptive message, and execution stack trace.

---

## 💡 Domain Modules & Service Specifications

### 1. Admin Module (`src/moudles/admin`)
Manages system administrators authentication and account creations. Admins possess global privileges allowing database rule manipulation, grade lock audits, academic settings configuration, and student onboarding.

*   **POST `/admin/signup`**
    *   **Authorization**: Public
    *   **Validation**: `signupAdminSchema` (Requires email format validation and a secure password matching: minimum 8 characters, containing at least 1 uppercase letter, 1 lowercase letter, and 1 numeric digit).
    *   **Logic**: Checks if email is already registered in the system. Hashes the password using `HASH` and saves a new admin record.
*   **POST `/admin/signin`**
    *   **Authorization**: Public
    *   **Validation**: `signinAdminSchema` (Requires email and password).
    *   **Logic**: Verifies database administrator existence, matches password hashes using `bcrypt.compare`, and issues a JWT token loaded with the admin identity and role.

---

### 2. Student Module (`src/moudles/student`)
Controls student profiles, auth portals, and bulk imports. Students use their academic credentials to log in, view current schedules, check past semesters transcripts, and execute registration.

*   **POST `/student/signin`**
    *   **Authorization**: Public
    *   **Validation**: `signinStudentSchema` (Requires `studentCode` and `nationalId`).
    *   **Logic**: Verifies credentials directly. If correct, generates a student JWT access token.
*   **POST `/student/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `addStudentSchema` (Requires `studentCode`, `nationalId` (14 numeric digits), `fullName`, `currentYear` (FIRST_YEAR, SECOND_YEAR, THIRD_YEAR, FOURTH_YEAR), and optional `departmentId`).
    *   **Logic**: Validates department capacity limits (`maxStudents`) before inserting a new student record to avoid overcrowding.
*   **POST `/student/bulk`**
    *   **Authorization**: Admin Only
    *   **Payload**: PDF File (`file`)
    *   **Logic**: Parses an academic registry PDF report. It filters header lines and parses table records split by `|` formatting. Extracts `fullName`, `studentCode`, `nationalId`, `currentYear`, and `departmentId`. Performs schema validations and registers non-existing student records in a batch, returning stats on successful and failed imports.
*   **GET `/student/profile/me`**
    *   **Authorization**: Student Only
    *   **Logic**: Aggregates the logged-in student's details, including department info, cumulative GPA, completed credits, actively registered courses, and past completed courses grouped by term and grade.
*   **GET `/student/all`**
    *   **Authorization**: Admin Only
    *   **Query Filters**: `departmentId`, `currentYear`
    *   **Logic**: Returns lists of students matching query criteria, showing their basic profiles and GPAs.
*   **GET `/student/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Retrieves a complete profile of a specific student by ID, including academic transcripts, active enrollments, and term-by-term GPA charts.
*   **DELETE `/student/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Cascades removal of a student from the database, dropping all historical records and enrollments.

---

### 3. Department Module (`src/moudles/Department`)
Maintains academic departments. Restricts enrollment capacity, enforces department GPAs, and reports year-wise student analytics.

*   **POST `/department/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `createDepartmentSchema` (Requires name, max capacity `maxStudents`, and minimum threshold `minGpa`).
    *   **Logic**: Instantiates a department.
*   **GET `/department/`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Lists all departments. Calculates active student count distributions across all academic years (`FIRST_YEAR` through `FOURTH_YEAR`).
*   **GET `/department/:id`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Details a single department, showing enrolled courses, student directories, and capacity counts.
*   **PUT `/department/:id`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateDepartmentSchema`
    *   **Logic**: Updates department rules. Prevents shrinking `maxStudents` below the current count of declared students in that department.
*   **DELETE `/department/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Deletes a department if no students are currently assigned to it.
*   **POST `/department/assign`**
    *   **Authorization**: Admin Only
    *   **Validation**: `assignStudentSchema` (Requires `studentId` and `departmentId`).
    *   **Logic**: Enforces assignment constraints:
        1. Checks department capacity limits.
        2. Student must not be assigned to another department.
        3. Restricts assignment if the student's cumulative GPA is lower than the department's configured `minGpa` (exempting first-year students who do not have a GPA yet).
*   **PATCH `/department/:studentId/remove`**
    *   **Authorization**: Admin Only
    *   **Logic**: Removes a student from a department. Blocks removal if the student is currently enrolled in any active course during the current term.
*   **GET `/department/:id/stats`**
    *   **Authorization**: Admin Only
    *   **Logic**: Calculates statistical aggregates for a department: total student count, available seats, average GPA, and year-by-year counts.

---

### 4. Course Module (`src/moudles/Course`)
Handles course curriculum listings, credit hours, and prerequisite mappings.

*   **POST `/course/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `createCourseSchema` (Requires name, unique `courseCode`, `creditHours`, target `yearNumber` (StudyYear), optional list of department IDs, and optional list of prerequisite course IDs).
    *   **Logic**: Validates department and prerequisite existences. Sets up many-to-many database relationships (prerequisites and department restrictions).
*   **GET `/course/`**
    *   **Authorization**: Admin & Student
    *   **Query Filters**: `page` (default 1), `limit` (default 10), `search` (matches course name or code), `departmentId`, `yearNumber`, `creditHours`.
    *   **Logic**: Retrieves a paginated list of courses filtered by the query parameters.
*   **GET `/course/:id`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Returns course details, including departments allowed to take the course and required prerequisite courses.
*   **PUT `/course/:id`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateCourseSchema`
    *   **Logic**: Updates course data and updates many-to-many relationship maps (prerequisites and department allocations).
*   **DELETE `/course/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Deletes the course from the curriculum, cascading deletion to dependent enrollment records.

---

### 5. Term Module (`src/moudles/Term`)
Defines academic terms, sets enrollment registration window timelines, and manages courses offered per semester.

*   **POST `/term/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `createTermSchema` (Requires `academicYear` (regex format `YYYY/YYYY`), `semester` (FIRST, SECOND, SUMMER), and registration windows for each student level).
    *   **Logic**: Ensures the term is unique. Creates the term and its registration windows in a database transaction.
*   **GET `/term/`**
    *   **Authorization**: Admin Only
    *   **Logic**: Lists all academic terms, showing registration windows and student enrollment counts.
*   **GET `/term/active`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Returns the currently active term with the timeline status of all registration windows (upcoming, open, closed) relative to the current server date.
*   **GET `/term/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Retrieves a term's details, including registration windows and their timeline statuses.
*   **PATCH `/term/:id/open`**
    *   **Authorization**: Admin Only
    *   **Logic**: Opens a term for registration. Enforces that:
        1. The term has configured registration windows.
        2. Any other open term is closed first (only one term can be active at a time).
*   **PATCH `/term/:id/close`**
    *   **Authorization**: Admin Only
    *   **Logic**: Closes the active term, ending all registration.
*   **POST `/term/:termId/windows`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateRegistrationWindowSchema`
    *   **Logic**: Registers a registration window timeline for a specific student level in the term.
*   **PATCH `/term/:termId/windows`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateRegistrationWindowSchema`
    *   **Logic**: Updates the dates of a registration window.
*   **POST `/term/:termId/courses`**
    *   **Authorization**: Admin Only
    *   **Validation**: `addCoursesToTermSchema` (Requires array of `courseIds`).
    *   **Logic**: Links courses to the term (`TermCourse`), defining which courses are offered and available for student registration this term.
*   **DELETE `/term/:termId/courses`**
    *   **Authorization**: Admin Only
    *   **Validation**: `removeCoursesFromTermSchema`
    *   **Logic**: Unlinks courses from the term, removing them from the term's offerings.
*   **GET `/term/:termId/courses`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Lists all courses offered in the specified term.
*   **PATCH `/term/:id/publish-grades`**
    *   **Authorization**: Admin Only
    *   **Logic**: Sets the `isGradesPublished` flag, allowing students to view their scores and final course marks.
*   **PATCH `/term/:id/appeals-window`**
    *   **Authorization**: Admin Only
    *   **Validation**: `setAppealsWindowSchema` (Requires future date `endDate`).
    *   **Logic**: Sets the deadline for grade appeals.

---

### 6. Enrollment Module (`src/moudles/Enrollment`)
The core validation engine of the system. It handles course registrations and checks all academic requirements before enrolling a student.

*   **POST `/enrollment/`**
    *   **Authorization**: Student Only
    *   **Validation**: `enrollSchema` (Requires `courseId`).
    *   **Logic (Registration Constraints Engine)**:
        1. **Term Verification**: Ensures an active term exists.
        2. **Registration Window check**: Enforces that the current server date falls within the registration window defined for the student's level (`currentYear`).
        3. **Course Offering check**: Confirms the course is offered in the active term.
        4. **Double Enrollment check**: Prevents duplicate enrollment in the same term.
        5. **Passed Courses check**: Blocks registration for a course the student has already passed in a previous semester.
        6. **Department Restriction check**: If the course is restricted to specific departments, it ensures the student is assigned to one of them.
        7. **Level Restriction check**: Restricts students from enrolling in courses above their year level (e.g., a Sophomore cannot take a Senior course).
        8. **GPA Threshold check**: Checks if the student meets the minimum GPA required for their level (e.g. Sophomores: 1.0, Juniors: 1.5, Seniors: 2.0).
        9. **Prerequisite completion check**: Verifies the student has passed all prerequisite courses (Grade $\neq$ 'F') in previous semesters.
        10. **Credit Hour check**: Resolves the student's maximum allowed credits based on their GPA (`CreditRules`) and ensures that adding this course will not exceed that limit.
*   **PATCH `/enrollment/:enrollmentId/drop`**
    *   **Authorization**: Student Only
    *   **Logic**: Drops a course (sets status to `DROPPED`). Allows dropping only if:
        1. The term is active.
        2. The registration window for the student's level is still open.
        3. The course grade is not locked.
*   **GET `/enrollment/my`**
    *   **Authorization**: Student Only
    *   **Logic**: Lists the logged-in student's current enrollments, total registered credits, max allowed credits, remaining credits, and registration window status.
*   **GET `/enrollment/available`**
    *   **Authorization**: Student Only
    *   **Logic**: Calculates and lists courses available for the student to register. It filters out already passed and currently registered courses, includes failed courses (retakes), and enforces department and year level restrictions.
*   **GET `/enrollment/`**
    *   **Authorization**: Admin Only
    *   **Query Filters**: `termId`, `studentId`
    *   **Logic**: Lists all enrollments matching filters.

---

### 7. Grade Module (`src/moudles/Grade`)
Manages academic grading. Computes GPAs, processes bulk imports, and enforces grading locks.

*   **POST `/grade/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `addGradeSchema` (Requires `enrollmentId` and `score` (0-100)).
    *   **Logic**: Resolves the numerical score to a letter grade and GPA points using the `GradeScale` mapping. Saves the grade and triggers GPA recalculation.
*   **POST `/grade/bulk`**
    *   **Authorization**: Admin Only
    *   **Payload**: CSV file (`file`), body fields (`termId`, `courseId`).
    *   **Logic**: Processes a CSV file of student grades (`studentCode,score`). For each record, it maps the student code to their enrollment, resolves the score to a letter grade, and updates or creates the grade record. Recalculates student GPAs in batches of 30 for performance.
*   **PATCH `/grade/:gradeId`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateGradeSchema` (Requires `score`).
    *   **Logic**: Updates a grade and recalculates GPAs. Blocks updates if the grade is locked.
*   **PATCH `/grade/:gradeId/lock`**
    *   **Authorization**: Admin Only
    *   **Logic**: Locks a grade, preventing any further updates.
*   **PATCH `/grade/lock-all/:termId`**
    *   **Authorization**: Admin Only
    *   **Logic**: Locks all grades and term GPA records for a term. Blocks locking if the appeals window is still open.
*   **GET `/grade/term/:termId`**
    *   **Authorization**: Admin Only
    *   **Logic**: Lists all grades recorded in the specified term.
*   **GET `/grade/my`**
    *   **Authorization**: Student Only
    *   **Logic**: Displays the student's grades grouped by term, along with their cumulative GPA and completed credits. Only shows grades if the term's grades are published.

#### 🧮 GPA Recalculation Engine
Recalculations are triggered whenever a grade is added or updated. The process runs as follows:
1. **Term GPA Calculation**: Sums the weighted GPA points of all graded courses in the term and divides by the total credit hours of those courses:
   $$\text{Term GPA} = \frac{\sum (\text{Course Credit Hours} \times \text{Grade GPA Points})}{\sum \text{Course Credit Hours}}$$
   Updates the student's `TermGpa` record.
2. **Cumulative GPA Calculation**: Aggregates all graded courses across all semesters:
   $$\text{Cumulative GPA} = \frac{\sum (\text{All Completed Course Credits} \times \text{Grade GPA Points})}{\sum \text{All Completed Course Credits}}$$
   Updates the student's overall cumulative GPA in both `StudentGpa` and `Student` tables.

---

### 8. GradeScale Module (`src/moudles/Gradescale`)
Defines the grading scale used to convert numerical scores into letter grades and GPA points.

*   **POST `/grade-scale/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `createGradeScaleSchema` (Requires `letterGrade`, `minScore`, `maxScore`, and `gpaPoints`).
    *   **Logic**: Creates a grade scale. Enforces that the score range does not overlap with any existing scale.
*   **POST `/grade-scale/bulk`**
    *   **Authorization**: Admin Only
    *   **Validation**: `bulkCreateGradeScaleSchema` (Requires an array of grade scale objects).
    *   **Logic**: Replaces the entire grading scale in a single transaction. Validates that there are no duplicate letter grades or overlapping score ranges in the input.
*   **GET `/grade-scale/`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Retrieves all grade scales sorted by score range descending.
*   **PATCH `/grade-scale/:id`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateGradeScaleSchema`
    *   **Logic**: Updates a grade scale. Enforces range uniqueness and overlap checks.
*   **DELETE `/grade-scale/all`**
    *   **Authorization**: Admin Only
    *   **Logic**: Deletes all configured grade scales.
*   **DELETE `/grade-scale/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Deletes a grade scale by its letter grade.

---

### 9. CreditRule Module (`src/moudles/Creditrule`)
Defines the maximum credit hours a student can register for based on their GPA.

*   **POST `/credit-rules/`**
    *   **Authorization**: Admin Only
    *   **Validation**: `createCreditRuleSchema` (Requires `minGpa`, `maxGpa`, `maxCredits`, and `isForNewStudents`).
    *   **Logic**: Creates a credit rule. Enforces that the GPA range does not overlap with existing rules. If marked `isForNewStudents`, it disables any other active rule for new students.
*   **GET `/credit-rules/`**
    *   **Authorization**: Admin & Student
    *   **Logic**: Lists all credit rules sorted by GPA range.
*   **PATCH `/credit-rules/:id`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updateCreditRuleSchema`
    *   **Logic**: Updates a credit rule, enforcing overlap checks.
*   **DELETE `/credit-rules/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Deletes a credit rule.

---

### 10. Promotion Module (`src/moudles/Promotion`)
Handles student academic level advancement (promotion) based on completed credits.

*   **POST `/promotion/rules`**
    *   **Authorization**: Admin Only
    *   **Validation**: `createPromotionRuleSchema` (Requires `fromYear` and `minCredits`).
    *   **Logic**: Creates a promotion rule. Blocks rules for `FOURTH_YEAR` since senior students graduate instead of promoting.
*   **GET `/promotion/rules`**
    *   **Authorization**: Admin Only
    *   **Logic**: Lists all promotion rules.
*   **PATCH `/promotion/rules/:id`**
    *   **Authorization**: Admin Only
    *   **Validation**: `updatePromotionRuleSchema`
    *   **Logic**: Updates the minimum credits required for a promotion rule.
*   **DELETE `/promotion/rules/:id`**
    *   **Authorization**: Admin Only
    *   **Logic**: Deletes a promotion rule.
*   **POST `/promotion/execute`**
    *   **Authorization**: Admin Only
    *   **Logic**: Executes the promotion process. It scans all students below `FOURTH_YEAR`, counts their total passed credits (grades $\neq$ 'F'), and promotes eligible students to the next level. Returns lists of promoted and retained students.
*   **GET `/promotion/preview`**
    *   **Authorization**: Admin Only
    *   **Logic**: Simulates the promotion process, returning a list of students who would be promoted or retained without updating the database.

---

### 11. AI Advisor Module (`src/moudles/AiAdvisor`)
Provides personalized, AI-powered academic advising using the Gemini API.

*   **POST `/ai-advisor/gpa-target`**
    *   **Authorization**: Student Only
    *   **Validation**: `gpaTargetSchema` (Requires a target cumulative GPA between 0.0 and 4.0).
    *   **Logic (Gemini Advising Engine)**:
        1. **Advising Data Preparation**: Gathers the student's current cumulative GPA, completed credits, actively registered courses, prerequisite dependencies, and the system grading scale.
        2. **Feasibility Analysis**: Calculates the mathematical feasibility of the target:
           $$\text{Max Possible GPA} = \frac{\text{Current GPA Points} + (4.0 \times \text{Active Credits})}{\text{Total Credits after Term}}$$
        3. **AI Advising Response**: Sends this structured data to the Gemini 2.5 Flash model. The AI generates a friendly Arabic advising response containing:
           *   **Feasibility**: Clear statement on whether the target is achievable. If not, it shows the maximum possible GPA they can reach.
           *   **Target Grades**: The grades the student needs to aim for in each of their current courses.
           *   **Prerequisite Warning**: A warning if failing any current course will block them from taking future dependent courses.
           *   **Study Tips**: Three actionable study tips.

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
ACCESS_TOKEN="YOUR_ACCESS_TOKEN_SECRET"
REFRESH_TOKEN="YOUR_REFRESH_TOKEN_SECRET"
SALT_ROUND=12
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### 3. Installation Steps
Execute the following commands to install dependencies, run migrations, and launch the server:

```bash
# 1. Install project dependencies
npm install

# 2. Sync database schema using Prisma
npm run build

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
