import { Router } from "express";
import AiAdvisorService from "./AiAdvisor.service";
import { validation } from "../../middleware/validation";
import { gpaTargetSchema } from "./AiAdvisor.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";

const aiAdvisorRouter = Router();

aiAdvisorRouter.post(
  "/gpa-target",
  authentication(),
  authorization("student"),
  validation(gpaTargetSchema),
  AiAdvisorService.planGpaTarget
);

export default aiAdvisorRouter;
