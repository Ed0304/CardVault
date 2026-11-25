"""CardVault AI service (internal).

Called only by the Express backend over a private network, with a shared bearer token. It holds
the Meta Model API key, has no database access, and returns structured results that Express
validates and stores. Browsers never call it, so there is no CORS configuration, and the
interactive API docs are disabled.

Run locally: uvicorn app:app --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from core.config import get_settings
from routers import catalog, health
from services.llm import MuseCatalogClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Reading the settings here fails fast on a missing key, model or token.
    settings = get_settings()
    app.state.catalog_client = MuseCatalogClient(settings)
    yield
    await app.state.catalog_client.close()


app = FastAPI(
    title="CardVault AI service",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.include_router(health.router)
app.include_router(catalog.router)
