import { Router } from "express";
import * as communityController from "../controllers/communityController.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";

const router = Router();

// Guests may read published cards (REQ-DISC-001). Saving a copy needs a signed-in user
// (REQ-DISC-002); the service only ever selects public columns of PUBLIC cards.
router.get("/cards", optionalAuthenticate, communityController.list);
router.get("/cards/:id", optionalAuthenticate, communityController.get);
router.post("/cards/:id/save", authenticate, communityController.save);

export default router;
