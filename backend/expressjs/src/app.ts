import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(helmet());

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to CardVault API!"
    });
});

app.use("/api/auth", authRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
