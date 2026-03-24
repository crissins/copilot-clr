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
        # Decode without verification first to get the tenant ID
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        tenant_id = unverified_claims.get("tid", "")

        jwk_client = _get_jwk_client()
        signing_key = jwk_client.get_signing_key_from_jwt(token)

        # Accept either v1.0 or v2.0 issuer format
        # v1.0: https://sts.windows.net/{tid}/
        # v2.0: https://login.microsoftonline.com/{tid}/v2.0
        valid_issuers = [
            f"https://sts.windows.net/{tenant_id}/",
            f"https://login.microsoftonline.com/{tenant_id}/v2.0",
        ]

        # Accept audience in either format:
        # - Just the client ID: "xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxxx"
        # - API URI format: "api://xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxxx"
        valid_audiences = [
            client_id,
            f"api://{client_id}",
        ]

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=valid_audiences,
            issuer=valid_issuers,
            options={
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )
        return claims

    except jwt.ExpiredSignatureError:
        raise AuthError("Token has expired")
    except jwt.InvalidAudienceError as e:
        logger.error("Invalid audience. Expected=%s, Got=%s", valid_audiences, jwt.decode(token, options={"verify_signature": False}).get("aud"))
        raise AuthError("Invalid token audience")
    except jwt.InvalidIssuerError as e:
        decoded = jwt.decode(token, options={"verify_signature": False})
        logger.error("Invalid issuer. Got=%s", decoded.get("iss"))
        raise AuthError("Invalid token issuer")
    except Exception as e:
        logger.exception("Token validation failed: %s", str(e))
        raise AuthError(f"Token validation failed: {str(e)}")
