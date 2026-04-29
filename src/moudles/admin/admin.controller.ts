import { Router } from "express";
import  AS from "./admin.service";
import { validation } from "../../middleware/validation";
import * as AV from "./admin.validation";



const adminRouter = Router()

adminRouter.post("/signup" ,validation(AV.signupAdminSchema),AS.signup)
adminRouter.post("/signin" ,validation(AV.signinAdminSchema),AS.signin)


export default adminRouter