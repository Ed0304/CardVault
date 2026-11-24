import type { Request, Response } from "express";
import { success } from "../lib/response.js";
import type { CreateCollectionInput, RenameCollectionInput } from "../schemas/collections.schemas.js";
import * as collectionService from "../services/collectionService.js";

// Every handler runs behind `authenticate`; the user id always comes from the verified session.
const userIdOf = (req: Request): string => req.user!.id;
const idOf = (req: Request): string => String(req.params.id);

export async function list(req: Request, res: Response): Promise<void> {
  res.status(200).json(success(await collectionService.getCollections(userIdOf(req))));
}

export async function create(req: Request, res: Response): Promise<void> {
  const collection = await collectionService.createCollection(
    userIdOf(req),
    req.body as CreateCollectionInput,
  );
  res.status(201).json(success(collection, "Collection created"));
}

export async function rename(req: Request, res: Response): Promise<void> {
  const collection = await collectionService.renameCollection(
    userIdOf(req),
    idOf(req),
    req.body as RenameCollectionInput,
  );
  res.status(200).json(success(collection, "Collection renamed"));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await collectionService.deleteCollection(userIdOf(req), idOf(req));
  res.status(200).json(success(null, "Collection deleted"));
}
