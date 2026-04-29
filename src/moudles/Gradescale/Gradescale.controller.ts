import { Router } from "express";
import GSS from "./Gradescale.service";
import { validation } from "../../middleware/validation";
import * as GSV from "./Gradescale.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const gradeScaleRouter = Router();

// Admin only
gradeScaleRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(GSV.createGradeScaleSchema),
  GSS.createScale
);

// bulk — الأدمن يحط كل الـ scale دفعة واحدة (بيمسح القديم ويحط الجديد)
gradeScaleRouter.post(
  "/bulk",
  authentication(),
  authorization("admin"),
  validation(GSV.bulkCreateGradeScaleSchema),
  GSS.bulkCreate
);

gradeScaleRouter.get(
  "/",
  authentication(),
  authorization("admin", "student"),
  GSS.getAllScales
);

gradeScaleRouter.patch(
  "/:id",
  authentication(),
  authorization("admin"),
  validation(GSV.updateGradeScaleSchema),
  GSS.updateScale
);

gradeScaleRouter.delete(
  "/all",
  authentication(),
  authorization("admin"),
  GSS.deleteAllScales
);

gradeScaleRouter.delete(
  "/:id",
  authentication(),
  authorization("admin"),
  GSS.deleteScale
);

export default gradeScaleRouter;