import { Router } from "express";
import * as preferencesController from "../controllers/preferencesController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validateBody.js";
import { updatePreferencesSchema } from "../schemas/preferences.schemas.js";

const router = Router();

// Preferences are private to their owner: every route requires a signed-in user.
router.use(authenticate);

router.get("/", preferencesController.get);
router.put("/", validateBody(updatePreferencesSchema), preferencesController.update);
router.get("/topics", preferencesController.topics);

export default router;
