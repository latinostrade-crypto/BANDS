import { Router } from "express";
import { getMe } from "../services/profile.js";

export const meRouter = Router();

meRouter.get("/me", async (req, res, next) => {
  try {
    res.json(await getMe(req.user!.id));
  } catch (error) {
    next(error);
  }
});
