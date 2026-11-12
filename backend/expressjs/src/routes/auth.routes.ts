import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validateBody.js";
import { loginSchema, registerSchema } from "../schemas/auth.schemas.js";

const router = Router();

router.post("/register", validateBody(registerSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
