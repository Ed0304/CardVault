import type { Request, Response } from "express";
import { success } from "../lib/response.js";
import type { UpdatePreferencesInput } from "../schemas/preferences.schemas.js";
import * as preferencesService from "../services/preferencesService.js";

// Every handler runs behind `authenticate`; the id comes from the verified session only.
const userIdOf = (req: Request): string => req.user!.id;

/** GET /api/preferences — null until onboarding is complete. */
export async function get(req: Request, res: Response): Promise<void> {
  const preferences = await preferencesService.getPreferences(userIdOf(req));
  res.status(200).json(success({ preferences }));
}

/** PUT /api/preferences — completes onboarding on the first save. */
export async function update(req: Request, res: Response): Promise<void> {
  const preferences = await preferencesService.savePreferences(
    userIdOf(req),
    req.body as UpdatePreferencesInput,
  );
  res.status(200).json(success({ preferences }, "Preferences saved"));
}

/** GET /api/preferences/topics */
export async function topics(_req: Request, res: Response): Promise<void> {
  res.status(200).json(success({ topics: await preferencesService.listTopicOptions() }));
}
