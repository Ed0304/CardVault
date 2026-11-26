import app from "./app.js";
import { config } from "./lib/config.js";

app.listen(config.port, () => {
    console.log(`CardVault Server Running on port ${config.port}`);
    if (config.isProduction && config.trustProxyHops === 0) {
        // Behind Railway's edge (and the Nuxt /api proxy), every guest would share the proxy's
        // address and therefore one guest rate limit.
        console.warn("[config] TRUST_PROXY_HOPS is 0 in production: guest rate limits will count all guests behind the proxy as one client. Set TRUST_PROXY_HOPS=1 on Railway.");
    }
});
