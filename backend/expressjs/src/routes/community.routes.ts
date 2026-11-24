import { Router } from "express";
import * as communityController from "../controllers/communityController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// The Community Catalog is open to every signed-in user, and to no one else.
router.use(authenticate);

router.get("/cards", communityController.list);
router.get("/cards/:id", communityController.get);
router.post("/cards/:id/save", communityController.save);

export default router;
