import { Router } from "express";
import SS from "./student.service";
import { validation } from "../../middleware/validation";
import * as SV from "./sutdent.validation";
import { authentication } from "../../middleware/authentication";
import { authorization } from "../../middleware/authorization";
import multer from "multer";

const studentRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public
studentRouter.post("/signin", validation(SV.signinStudentSchema), SS.signin);

// Student only
studentRouter.get(
  "/profile/me",
  authentication(),
  authorization("student"),
  SS.getProfile
);

// Admin only
studentRouter.post(
  "/",
  authentication(),
  authorization("admin"),
  validation(SV.addStudentSchema),
  SS.addStudent
);

studentRouter.post(
  "/bulk",
  authentication(),
  authorization("admin"),
  upload.single("file"),
  SS.addStudentsBulk
);

studentRouter.get(
  "/all",
  authentication(),
  authorization("admin"),
  SS.getAllStudents
);

studentRouter.get(
  "/:id",
  authentication(),
  authorization("admin"),
  SS.getStudent
);

studentRouter.delete(
  "/:id",
  authentication(),
  authorization("admin"),
  SS.deleteStudent
);



export default studentRouter;