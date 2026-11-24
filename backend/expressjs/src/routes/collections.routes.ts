import { Router } from "express";
import * as collectionController from "../controllers/collectionController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validateBody.js";
import { createCollectionSchema, renameCollectionSchema } from "../schemas/collections.schemas.js";

const router = Router();

// Every collection route requires a signed-in user.
router.use(authenticate);

router.get("/", collectionController.list);
router.post("/", validateBody(createCollectionSchema), collectionController.create);
router.patch("/:id", validateBody(renameCollectionSchema), collectionController.rename);
router.delete("/:id", collectionController.remove);

export default router;
