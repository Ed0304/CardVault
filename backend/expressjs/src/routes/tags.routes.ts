import { Router } from "express";
import * as tagController from "../controllers/tagController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validateBody.js";
import { createTagSchema } from "../schemas/tags.schemas.js";

const router = Router();

// Every tag route requires a signed-in user.
router.use(authenticate);

router.get("/", tagController.list);
router.post("/", validateBody(createTagSchema), tagController.create);
router.delete("/:id", tagController.remove);

export default router;
