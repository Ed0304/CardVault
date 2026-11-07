import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

app.use(helmet());

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to CardVault API!"
    });
});

export default app;