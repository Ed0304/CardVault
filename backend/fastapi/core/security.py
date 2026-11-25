"""Internal authentication: only the Express backend may call this service (decision D-5)."""

import hmac

from fastapi import Depends, Header, HTTPException, status

from core.config import Settings, get_settings


def require_internal_token(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = f"Bearer {settings.ai_service_token.get_secret_value()}"
    # Constant-time comparison, so the token cannot be guessed from response timing.
    if authorization is None or not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing or invalid service token"},
        )
