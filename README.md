# University System API 🎓

نظام إدارة جامعي متكامل (Backend API) مبني باستخدام **Node.js** و **Express.js** و **TypeScript** مع **Prisma ORM** وقاعدة بيانات **PostgreSQL**.

هذا المشروع يهدف إلى إدارة كل ما يخص الجامعة من طلاب، مواد، أقسام، فصول دراسية (Terms)، عمليات التسجيل (Enrollment)، ورصد الدرجات.

---

## 🚀 التقنيات المستخدمة (Tech Stack)

- **Node.js & Express.js**: لإنشاء خوادم الـ API.
- **TypeScript**: لكتابة كود قوي ومنظم وخالي من الأخطاء.
- **Prisma**: كـ ORM للتعامل مع قاعدة البيانات بسهولة وأمان.
- **PostgreSQL**: قاعدة البيانات الأساسية.
- **Zod**: للتحقق من صحة البيانات المدخلة (Data Validation).
- **Bcrypt & JSON Web Token (JWT)**: للتوثيق والحماية (Authentication & Authorization).
- **Multer**: لرفع الملفات (مثل إضافة طلاب أو درجات بالجملة عن طريق ملفات).
- **Helmet & Express Rate Limit**: لحماية الـ API من الهجمات.

---

## 📂 هيكل المشروع (Project Structure)

المشروع متقسم بناءً على نظام الـ **Modules**، كل جزء مستقل بذاته لتسهيل الصيانة والتطوير:

```text
src/
├── middleware/       # الـ Middlewares الخاصة بالحماية، التوثيق، والـ Validation
├── utils/            # أدوات مساعدة (مثل معالجة الأخطاء AppError)
└── moudles/          # الموديولات الأساسية للنظام
    ├── admin/        # إدارة حسابات المديرين (تسجيل الدخول والإضافة)
    ├── student/      # إدارة الطلاب، بروفايل الطالب، والإضافة الفردية أو المجمعة
    ├── Department/   # إدارة الأقسام (إنشاء قسم، ربط طالب بقسم)
    ├── Course/       # إدارة المواد الدراسية والمتطلبات السابقة (Prerequisites)
    ├── Term/         # إدارة الفصول الدراسية (فتح وإغلاق الترم، فترات التسجيل)
    ├── Enrollment/   # إدارة تسجيل الطلاب في المواد (حذف، إضافة، عرض المواد المتاحة)
    ├── Grade/        # رصد الدرجات (فردي ومجمع)، وحساب المعدل التراكمي (GPA)
    ├── Gradescale/   # مقياس الدرجات (A, B, C...) وحساب النقاط بناءً عليها
    ├── Creditrule/   # قواعد الساعات المعتمدة للطلاب (الحد الأقصى للتسجيل بناءً على הـ GPA)
    └── Promotion/    # قواعد ترقية الطلاب للسنوات الدراسية التالية
```

---

## 💡 الموديولات الأساسية (Core Modules)

### 1. `Admin` & `Student` (المستخدمين)
- نظام بصلاحيتين: `admin` و `student`.
- يمكن للإدمن إضافة الطلاب بشكل فردي أو مجمع (Bulk Upload).
- الطالب يمتلك لوحة تحكم (Profile) لعرض بياناته وحالته الأكاديمية.

### 2. `Term` (الفصول الدراسية)
- إدارة الترم (الأول، الثاني، الصيفي).
- التحكم في تفعيل الترم (`Active Term`).
- **Registration Windows**: تحديد فترات تسجيل محددة (Start/End Date) لكل فرقة دراسية (مثال: فتح التسجيل لسنة أولى في يوم معين).

### 3. `Course` & `Department` (المواد والأقسام)
- ربط المواد بالأقسام، وتحديد المواد المطلوبة مسبقاً (Prerequisites).
- ربط الطلاب بالأقسام بناءً على شروط (مثل الـ GPA).

### 4. `Enrollment` (عملية التسجيل)
- أهم جزء في النظام، يسمح للطالب بتسجيل المواد بناءً على:
  - هل الترم مفتوح وهل هو داخل فترة التسجيل الخاصة به؟
  - هل نجح في المواد المطلوبة مسبقاً (Prerequisites)؟
  - هل مسموح له بعدد الساعات بناءً على الـ GPA (Credit Rules)؟
- الدالة `getAvailableCourses`: تعرض للطالب المواد الجديدة المتاحة له ومواد الرسوب التي يمكن إعادتها.

### 5. `Grade` & `GradeScale` (الدرجات)
- إدخال الدرجات للطلاب (فردي أو Bulk).
- تحويل الدرجة الرقمية إلى حروف (A, B+, F) بناءً على الـ `GradeScale`.
- قفل الدرجات (`Lock`) بعد المراجعة لمنع تعديلها، وحساب الـ GPA الأتوماتيكي.

---

## 🛠️ التجهيز والتشغيل (Setup & Installation)

### 1. المتطلبات الأساسية
- Node.js (يفضل إصدار 18+)
- PostgreSQL

### 2. خطوات التشغيل

```bash
# 1. تحميل الحزم
npm install

# 2. إعداد ملف البيئة (Environment Variables)
# قم بإنشاء ملف .env في المسار config/.env أو في جذر المشروع حسب الإعدادات وضع فيه المتغيرات الآتية:
DATABASE_URL="postgresql://user:password@localhost:5432/university_db?schema=public"
PORT=5000
JWT_SECRET="your_jwt_secret_key"

# 3. تشغيل أوامر Prisma لبناء قاعدة البيانات
npx prisma generate
npx prisma db push

# 4. تشغيل السيرفر في وضع التطوير
npm run start:dev
```

---

## 📝 رسالة لمسؤول التوثيق (For the Documentation Team)

هذا الجزء موجه للشخص المسؤول عن كتابة الـ API Documentation (مثل Postman أو Swagger):

1. **طريقة العمل**:
   - كل الـ Endpoints موجودة بداخل مجلد `src/moudles/` كل في مجلده الخاص (مثال: `src/moudles/Term/Term.controller.ts`).
   - معظم الـ Routes تتطلب إرسال `Token` في الـ Header من نوع `Bearer Token`.
   - لمعرفة الصلاحيات المطلوبة لكل Endpoint (هل هي لـ Admin أم Student)، انظر إلى الـ Middleware `authorization("admin")` أو `authorization("student")` في ملف الـ `controller`.
   - لمعرفة شكل الـ Request Body المطلوب، انظر إلى ملف الـ `*.validation.ts` الموجود مع كل موديول (مكتوب باستخدام Zod).

2. **تسلسل العمليات (Workflow) لفهم النظام**:
   - يجب أولاً إنشاء Admin (Sign up / Sign in).
   - إضافة الـ Grade Scales.
   - إضافة Credit Rules و Promotion Rules.
   - إنشاء Departments و Courses.
   - إضافة Students (وهم بيعملوا Signin باستخدام الـ `studentCode` أو حسب الإعدادات).
   - إنشاء Term وتفعيله وفتح Registration Windows لفرق معينة وربط مواد به (`addCoursesToTerm`).
   - يدخل الطالب يعمل Enrollment في المواد المتاحة (`/enrollment/available`).
   - الإدمن يقوم برفع الـ Grades.

---
*تم إعداد هذا الملف لتسهيل فهم هيكل و منطق العمل في مشروع نظام الجامعة.*
