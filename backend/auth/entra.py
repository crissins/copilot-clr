"""
Entra ID Token Validation

Validates JWT tokens issued by Microsoft Entra ID.
Uses OIDC discovery to get signing keys — no hardcoded keys.
"""

import json
import logging
import os
from urllib.request import urlopen

import jwt
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

# Microsoft Entra ID OIDC configuration
AUTHORITY = "https://login.microsoftonline.com/common"
OIDC_CONFIG_URL = f"{AUTHORITY}/v2.0/.well-known/openid-configuration"

# Cache the JWK client
_jwk_client: PyJWKClient | None = None


class AuthError(Exception):
    """Authentication error."""
    pass


def _get_jwk_client() -> PyJWKClient:
    """Get or create cached JWK client for token validation."""
    global _jwk_client
    if _jwk_client is None:
        # Fetch OIDC config to get JWKS URI
        with urlopen(OIDC_CONFIG_URL) as response:
            config = json.loads(response.read())
        _jwk_client = PyJWKClient(config["jwks_uri"])
    return _jwk_client


def validate_token(token: str, client_id: str) -> dict:
    """
    Validate a Microsoft Entra ID JWT token.

    Args:
        token: The raw JWT token string
        client_id: The expected audience (app registration client ID)

    Returns:
        Decoded token claims

    Raises:
        AuthError: If token is invalid
    """
    try:
        jwk_client = _get_jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(token)

        # Pre-decode without verification to extract tenant ID for issuer validation
        unverified = jwt.decode(token, options={"verify_signature": False})
        tenant_id = unverified.get("tid", "common")

        # v2.0 tokens issued for a custom API scope (api://{clientId}/access_as_user)
        # have aud=api://{clientId}, while tokens for the app itself have aud={clientId}.
        # Accept both so the backend works regardless of which scope the frontend used.
        valid_audiences = [client_id, f"api://{client_id}"]

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=valid_audiences,
            issuer=f"https://login.microsoftonline.com/{tenant_id}/v2.0",
            options={
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )
        return claims

    except jwt.ExpiredSignatureError:
        raise AuthError("Token has expired")
    except jwt.InvalidAudienceError:
        raise AuthError("Invalid token audience")
    except jwt.InvalidIssuerError:
        raise AuthError("Invalid token issuer")
    except Exception as e:
        logger.exception("Token validation failed")
        raise AuthError(f"Token validation failed: {str(e)}")
