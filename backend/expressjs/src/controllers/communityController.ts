import type { Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { success } from "../lib/response.js";
import { listPublicCardsQuerySchema } from "../schemas/cards.schemas.js";
import * as communityService from "../services/communityService.js";

// Every handler runs behind `authenticate`; the viewer's id always comes from the verified session.
const userIdOf = (req: Request): string => req.user!.id;
const cardIdOf = (req: Request): string => String(req.params.id);

/** GET /api/community/cards */
export async function list(req: Request, res: Response): Promise<void> {
  const parsed = listPublicCardsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", "Invalid query parameters", details);
  }
  res.status(200).json(success(await communityService.listPublicCards(parsed.data)));
}

/** GET /api/community/cards/:id */
export async function get(req: Request, res: Response): Promise<void> {
  res.status(200).json(success(await communityService.getPublicCard(userIdOf(req), cardIdOf(req))));
}

/** POST /api/community/cards/:id/save */
export async function save(req: Request, res: Response): Promise<void> {
  const card = await communityService.saveToVault(userIdOf(req), cardIdOf(req));
  res.status(201).json(success(card, "Card saved to your vault"));
}
