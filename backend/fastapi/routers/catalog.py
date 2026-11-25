"""POST /catalog: one catalog entry (summary, subjects, keywords) for one card's text."""

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from core.security import require_internal_token
from models.catalog import CatalogRequest, CatalogResponse
from services.llm import CatalogGenerationError, MuseCatalogClient

router = APIRouter(dependencies=[Depends(require_internal_token)])


def get_catalog_client(request: Request) -> MuseCatalogClient:
    return request.app.state.catalog_client


@router.post(
    "/catalog",
    response_model=CatalogResponse,
    responses={502: {"description": "Provider rejected or bad output"}, 503: {"description": "Provider unavailable"}},
)
async def create_catalog(
    payload: CatalogRequest, client: MuseCatalogClient = Depends(get_catalog_client)
) -> CatalogResponse | JSONResponse:
    try:
        return await client.generate_catalog(payload)
    except CatalogGenerationError as error:
        # Only a stable code and a generic message go back to Express; never provider details.
        return JSONResponse(
            status_code=error.status_code,
            content={"error": {"code": error.code}, "message": error.message},
        )
