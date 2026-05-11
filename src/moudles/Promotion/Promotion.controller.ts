import { Router } from "express";
import PS from "./Promotion.service";
import { validation } from "../../middleware/validation";
import * as PV from "./Promotion.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const promotionRouter = Router();


promotionRouter.post(
  "/rules",
  authentication(),
  authorization("admin"),
  validation(PV.createPromotionRuleSchema),
  PS.createRule
);

promotionRouter.get(
  "/rules",
  authentication(),
  authorization("admin"),
  PS.getAllRules
);

promotionRouter.patch(
  "/rules/:id",
  authentication(),
  authorization("admin"),
  validation(PV.updatePromotionRuleSchema),
  PS.updateRule
);

promotionRouter.delete(
  "/rules/:id",
  authentication(),
  authorization("admin"),
  PS.deleteRule
);


promotionRouter.post(
  "/execute",
  authentication(),
  authorization("admin"),
  PS.promoteStudents
);


promotionRouter.get(
  "/preview",
  authentication(),
  authorization("admin"),
  PS.previewPromotion
);

export default promotionRouter;
