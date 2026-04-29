import { Router } from "express";
import ES from "./Enrollment.service";
import { validation } from "../../middleware/validation";
import * as EV from "./Enrollment.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const enrollmentRouter = Router();

// Student
enrollmentRouter.post(
  "/",
  authentication(),
  authorization("student"),
  validation(EV.enrollSchema),
  ES.enroll
);

enrollmentRouter.patch(
  "/:enrollmentId/drop",
  authentication(),
  authorization("student"),
  ES.dropCourse
);

enrollmentRouter.get(
  "/my",
  authentication(),
  authorization("student"),
  ES.getMyEnrollments
);

enrollmentRouter.get(
  "/available",
  authentication(),
  authorization("student"),
  ES.getAvailableCourses
);

// Admin
enrollmentRouter.get(
  "/",
  authentication(),
  authorization("admin"),
  ES.getAllEnrollments
);

export default enrollmentRouter;