import app from "./app.js";
import { config } from "./lib/config.js";

app.listen(config.port, () => {
    console.log(`CardVault Server Running on port ${config.port}`);
});
