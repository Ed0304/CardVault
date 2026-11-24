import type { Request, Response } from "express";
import { success } from "../lib/response.js";
import type { CreateTagInput } from "../schemas/tags.schemas.js";
import * as tagService from "../services/tagService.js";

// Every handler runs behind `authenticate`; the user id always comes from the verified session.
const userIdOf = (req: Request): string => req.user!.id;

export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(success(await tagService.getTags(userIdOf(req))));
}

export async function create(req: Request, res: Response): Promise<void> {
  const tag = await tagService.createTag(userIdOf(req), req.body as CreateTagInput);
  res.status(201).json(success(tag, "Tag created"));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await tagService.deleteTag(userIdOf(req), String(req.params.id));
  res.status(200).json(success(null, "Tag deleted"));
}

/** POST /api/cards/:id/tags/:tagId */
export async function applyToCard(req: Request, res: Response): Promise<void> {
  const card = await tagService.applyTagToCard(userIdOf(req), String(req.params.id), String(req.params.tagId));
  res.status(200).json(success(card, "Tag added"));
}

/** DELETE /api/cards/:id/tags/:tagId */
export async function removeFromCard(req: Request, res: Response): Promise<void> {
  const card = await tagService.removeTagFromCard(
    userIdOf(req),
    String(req.params.id),
    String(req.params.tagId),
  );
  res.status(200).json(success(card, "Tag removed"));
}
