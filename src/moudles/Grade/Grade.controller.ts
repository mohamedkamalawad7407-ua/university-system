import { Router } from "express";
import GS from "./Grade.service";
import { validation } from "../../middleware/validation";
import * as GV from "./Grade.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const gradeRouter = Router();

// Admin
gradeRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(GV.addGradeSchema),
  GS.addGrade
);

gradeRouter.patch(
  "/:gradeId",
  authentication(),
  authorization("admin"),
  validation(GV.updateGradeSchema),
  GS.updateGrade
);

gradeRouter.patch(
  "/:gradeId/lock",
  authentication(),
  authorization("admin"),
  GS.lockGrade
);

gradeRouter.patch(
  "/lock-all/:termId",
  authentication(),
  authorization("admin"),
  GS.lockAllGradesInTerm
);

gradeRouter.get(
  "/term/:termId",
  authentication(),
  authorization("admin"),
  GS.getGradesByTerm
);

// Student
gradeRouter.get(
  "/my",
  authentication(),
  authorization("student"),
  GS.getMyGrades
);

export default gradeRouter;