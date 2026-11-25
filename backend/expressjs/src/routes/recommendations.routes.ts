import { Router } from "express";
import * as recommendationController from "../controllers/recommendationController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// Recommendations are built from the user's own preferences and vault: signed-in users only.
router.use(authenticate);

router.get("/", recommendationController.list);

export default router;
