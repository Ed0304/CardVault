import { Router } from "express";
import * as catalogingController from "../controllers/catalogingController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/status", catalogingController.status);

export default router;
