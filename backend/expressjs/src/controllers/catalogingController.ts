import type { Request, Response } from "express";
import { success } from "../lib/response.js";
import * as catalogingService from "../services/catalogingService.js";

// Every handler runs behind `authenticate`; the user id always comes from the verified session.
const userIdOf = (req: Request): string => req.user!.id;
const cardIdOf = (req: Request): string => String(req.params.id);

/** GET /api/ai/status: whether the AI features can be offered. Reveals no configuration. */
export function status(_req: Request, res: Response): void {
  res.status(200).json(success({ catalog: { available: catalogingService.isCatalogAvailable() } }));
}

/** POST /api/cards/:id/catalog */
export async function requestCatalog(req: Request, res: Response): Promise<void> {
  const card = await catalogingService.requestCatalog(userIdOf(req), cardIdOf(req));
  res.status(200).json(success(card, "Catalog suggestions ready for review"));
}

/** DELETE /api/cards/:id/catalog/draft */
export async function discardDraft(req: Request, res: Response): Promise<void> {
  const card = await catalogingService.discardDraft(userIdOf(req), cardIdOf(req));
  res.status(200).json(success(card, "Suggestions discarded"));
}
