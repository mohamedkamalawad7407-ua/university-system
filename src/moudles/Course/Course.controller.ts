import { Router } from "express";
import CS from "./Course.service";
import { validation } from "../../middleware/validation";
import * as CV from "./Course.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const courseRouter = Router();

courseRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(CV.createCourseSchema),
  CS.createCourse
);

courseRouter.get(
  "/",
  authentication(),
  authorization("admin", "student"),
  CS.getAllCourses
);

courseRouter.get(
  "/:id",
  authentication(),
  authorization("admin", "student"),
  CS.getCourse
);

courseRouter.put(
  "/:id",
  authentication(),
  authorization("admin"),
  validation(CV.updateCourseSchema),
  CS.updateCourse
);

courseRouter.delete(
  "/:id",
  authentication(),
  authorization("admin"),
  CS.deleteCourse
);

export default courseRouter;