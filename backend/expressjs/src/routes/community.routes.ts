import { Router } from "express";
import * as communityController from "../controllers/communityController.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { guestRateLimit } from "../middleware/guestRateLimit.js";

const router = Router();

// Guests may read published cards (REQ-DISC-001), limited per client IP (TASK-DISC-022);
// signed-in readers are not counted. Saving a copy needs a signed-in user (REQ-DISC-002). The
// service only ever selects public columns of PUBLIC cards.
router.get("/cards", optionalAuthenticate, guestRateLimit, communityController.list);
router.get("/cards/:id", optionalAuthenticate, guestRateLimit, communityController.get);
router.post("/cards/:id/save", authenticate, communityController.save);

export default router;
