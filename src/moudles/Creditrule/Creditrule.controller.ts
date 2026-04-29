import { Router } from "express";
import CRS from "./Creditrule.service";
import { validation } from "../../middleware/validation";
import * as CRV from "./Creditrule.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const creditRuleRouter = Router();

creditRuleRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(CRV.createCreditRuleSchema),
  CRS.createRule
);

creditRuleRouter.get(
  "/",
  authentication(),
  authorization("admin", "student"),
  CRS.getAllRules
);

creditRuleRouter.patch(
  "/:id",
  authentication(),
  authorization("admin"),
  validation(CRV.updateCreditRuleSchema),
  CRS.updateRule
);

creditRuleRouter.delete(
  "/:id",
  authentication(),
  authorization("admin"),
  CRS.deleteRule
);

export default creditRuleRouter;