import { Router } from "express";
import * as cardController from "../controllers/cardController.js";
import * as catalogingController from "../controllers/catalogingController.js";
import * as tagController from "../controllers/tagController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validateBody.js";
import {
  createCardFromUrlSchema,
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
router.post("/from-url", validateBody(createCardFromUrlSchema), cardController.createFromUrl);
router.get("/:id", cardController.get);
router.patch("/:id/notes", validateBody(updateNotesSchema), cardController.updateNotes);
router.patch("/:id/ai-metadata", validateBody(updateAiMetadataSchema), cardController.updateAiMetadata);
router.delete("/:id", cardController.remove);

// AI cataloging: Muse suggests catalog details as a draft for the owner to review.
router.post("/:id/catalog", catalogingController.requestCatalog);
router.delete("/:id/catalog/draft", catalogingController.discardDraft);

// Publishing to the Community Catalog (owner only, like every route here).
router.patch("/:id/visibility", validateBody(setVisibilitySchema), cardController.setVisibility);

// Organisation: one collection per card, any number of tags.
router.patch("/:id/collection", validateBody(setCollectionSchema), cardController.setCollection);
router.post("/:id/tags/:tagId", tagController.applyToCard);
router.delete("/:id/tags/:tagId", tagController.removeFromCard);

export default router;
