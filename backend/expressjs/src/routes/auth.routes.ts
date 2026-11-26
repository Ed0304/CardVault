import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";
import { loginRateLimit, registerRateLimit } from "../middleware/authRateLimit.js";
import { validateBody } from "../middleware/validateBody.js";
import { loginSchema, registerSchema } from "../schemas/auth.schemas.js";

const router = Router();

// Rate limits run after validation (so the email is normalized and malformed requests, which
// never reach Argon2, are not counted) and before any password hashing (TASK-AUTH-025).
router.post("/register", validateBody(registerSchema), registerRateLimit, authController.register);
router.post("/login", validateBody(loginSchema), loginRateLimit, authController.login);
// Not limited: refresh needs a 256-bit random token and runs no password check, and the app
// calls it on its own; logout and /me are cheap and need a session.
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
