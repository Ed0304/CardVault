"""GET /health: liveness check. Makes no provider call and reveals no credentials."""

from fastapi import APIRouter, Depends

from core.config import Settings, get_settings

router = APIRouter()


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {"status": "ok", "catalog_model": settings.catalog_model}
