import { Router } from "express";
import DS from "./Department.service";
import { validation } from "../../middleware/validation";
import * as DV from "./Department.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const departmentRouter = Router();

departmentRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(DV.createDepartmentSchema),
  DS.createDepartment
);

departmentRouter.get(
  "/",
  authentication(),
  authorization("admin", "student"),
  DS.getAllDepartments
);

departmentRouter.get(
  "/:id/stats",
  authentication(),
  authorization("admin"),
  DS.getDepartmentStats
);

departmentRouter.get(
  "/:id",
  authentication(),
  authorization("admin", "student"),
  DS.getDepartment
);

departmentRouter.put(
  "/:id",
  authentication(),
  authorization("admin"),
  validation(DV.updateDepartmentSchema),
  DS.updateDepartment
);

departmentRouter.delete(
  "/:id",
  authentication(),
  authorization("admin"),
  DS.deleteDepartment
);

departmentRouter.post(
  "/assign",
  authentication(),
  authorization("admin"),
  validation(DV.assignStudentSchema),
  DS.assignStudent
);

departmentRouter.patch(
  "/:studentId/remove",
  authentication(),
  authorization("admin"),
  DS.removeStudent
);

export default departmentRouter;