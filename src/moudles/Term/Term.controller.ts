import { Router } from "express";
import TS from "./Term.service";
import { validation } from "../../middleware/validation";
import * as TV from "./Term.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const termRouter = Router();

// Admin
termRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(TV.createTermSchema),
  TS.createTerm
);

termRouter.get(
  "/",
  authentication(),
  authorization("admin"),
  TS.getAllTerms
);

termRouter.get(
  "/active",
  authentication(),
  authorization("admin", "student"),
  TS.getActiveTerm
);

termRouter.get(
  "/:id",
  authentication(),
  authorization("admin"),
  TS.getTerm
);

termRouter.patch(
  "/:id/open",
  authentication(),
  authorization("admin"),
  TS.openTerm
);

termRouter.patch(
  "/:id/close",
  authentication(),
  authorization("admin"),
  TS.closeTerm
);

// إضافة أو تعديل نافذة تسجيل
termRouter.post(
  "/:termId/windows",
  authentication(),
  authorization("admin"),
  validation(TV.updateRegistrationWindowSchema),
  TS.addRegistrationWindow
);

termRouter.patch(
  "/:termId/windows",
  authentication(),
  authorization("admin"),
  validation(TV.updateRegistrationWindowSchema),
  TS.updateRegistrationWindow
);

termRouter.delete(
  "/:id",
  authentication(),
  authorization("admin"),
  TS.deleteTerm
);

export default termRouter;