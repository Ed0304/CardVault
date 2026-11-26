import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import cardsRouter from "./routes/cards.routes.js";
import collectionsRouter from "./routes/collections.routes.js";
import tagsRouter from "./routes/tags.routes.js";
import communityRouter from "./routes/community.routes.js";
import aiRouter from "./routes/ai.routes.js";
import preferencesRouter from "./routes/preferences.routes.js";
import recommendationsRouter from "./routes/recommendations.routes.js";
import { MAX_SOURCE_TEXT_LENGTH } from "./schemas/cards.schemas.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { config } from "./lib/config.js";

const app = express();

// Number of trusted reverse proxies, so req.ip is the client's address (TRUST_PROXY_HOPS, default
// 0: forwarded headers are ignored). Only the guest rate limiter reads req.ip.
app.set("trust proxy", config.trustProxyHops);

app.use(helmet());

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

// Card bodies carry pasted source text, so /api/cards gets a larger limit than the 10 KB used
// everywhere else. UTF-8 text can take up to 4 bytes per character, plus room for the JSON
// envelope. This must run before the app-wide parser, which then skips the parsed body.
app.use("/api/cards", express.json({ limit: MAX_SOURCE_TEXT_LENGTH * 4 + 16 * 1024 }));
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to CardVault API!"
    });
});

app.use("/api/auth", authRouter);
app.use("/api/cards", cardsRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/community", communityRouter);
app.use("/api/ai", aiRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/recommendations", recommendationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
