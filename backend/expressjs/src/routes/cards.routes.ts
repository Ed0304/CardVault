import { Router } from "express";
import * as cardController from "../controllers/cardController.js";
import * as tagController from "../controllers/tagController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validateBody.js";
import {
  createCardSchema,
  setCollectionSchema,
  setVisibilitySchema,
  updateAiMetadataSchema,
  updateNotesSchema,
} from "../schemas/cards.schemas.js";

const router = Router();

// Every card route requires a signed-in user.
router.use(authenticate);

router.get("/", cardController.list);
router.post("/", validateBody(createCardSchema), cardController.create);
router.get("/:id", cardController.get);
router.patch("/:id/notes", validateBody(updateNotesSchema), cardController.updateNotes);
router.patch("/:id/ai-metadata", validateBody(updateAiMetadataSchema), cardController.updateAiMetadata);
router.delete("/:id", cardController.remove);

// Publishing to the Community Catalog (owner only, like every route here).
router.patch("/:id/visibility", validateBody(setVisibilitySchema), cardController.setVisibility);

// Organisation: one collection per card, any number of tags.
router.patch("/:id/collection", validateBody(setCollectionSchema), cardController.setCollection);
router.post("/:id/tags/:tagId", tagController.applyToCard);
router.delete("/:id/tags/:tagId", tagController.removeFromCard);

export default router;
