import type { Request, Response } from "express";
import { success } from "../lib/response.js";
import * as recommendationService from "../services/recommendationService.js";

/** GET /api/recommendations — runs behind `authenticate`. */
export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(success(await recommendationService.getRecommendations(req.user!.id)));
}
