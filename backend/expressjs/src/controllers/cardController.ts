import type { Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { success } from "../lib/response.js";
import {
  listCardsQuerySchema,
  type CreateCardInput,
  type SetCollectionInput,
  type UpdateAiMetadataInput,
  type UpdateNotesInput,
} from "../schemas/cards.schemas.js";
import * as cardService from "../services/cardService.js";

// Every handler runs behind `authenticate`, so req.user is set. The user id always comes from
// the verified session, never from the request body or query.
const userIdOf = (req: Request): string => req.user!.id;
const cardIdOf = (req: Request): string => String(req.params.id);

export async function list(req: Request, res: Response): Promise<void> {
  const parsed = listCardsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", "Invalid query parameters", details);
  }
  res.status(200).json(success(await cardService.listCards(userIdOf(req), parsed.data)));
}

export async function create(req: Request, res: Response): Promise<void> {
  const card = await cardService.createCard(userIdOf(req), req.body as CreateCardInput);
  res.status(201).json(success(card, "Card created"));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.status(200).json(success(await cardService.getCard(userIdOf(req), cardIdOf(req))));
}

export async function updateNotes(req: Request, res: Response): Promise<void> {
  const card = await cardService.updateNotes(userIdOf(req), cardIdOf(req), req.body as UpdateNotesInput);
  res.status(200).json(success(card, "Notes updated"));
}

export async function updateAiMetadata(req: Request, res: Response): Promise<void> {
  const card = await cardService.updateAiMetadata(
    userIdOf(req),
    cardIdOf(req),
    req.body as UpdateAiMetadataInput,
  );
  res.status(200).json(success(card, "Catalog metadata updated"));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await cardService.deleteCard(userIdOf(req), cardIdOf(req));
  res.status(200).json(success(null, "Card deleted"));
}

export async function setCollection(req: Request, res: Response): Promise<void> {
  const card = await cardService.setCollection(userIdOf(req), cardIdOf(req), req.body as SetCollectionInput);
  res.status(200).json(success(card, card.collection ? "Card added to collection" : "Card removed from collection"));
}
