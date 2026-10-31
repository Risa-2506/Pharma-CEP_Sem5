from datetime import datetime, timezone, timedelta
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return check_password_hash(hashed_password, plain_password)


def create_access_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "userId": str(user.get("_id") or user.get("userId")),
        "username": user.get("username"),
        "email": user.get("email"),
        "fullName": user.get("fullName", user.get("name", "")),
        "role": user.get("role"),
        "status": user.get("status", "Active"),
        "organizationId": str(user.get("organizationId", "")),
        "organizationName": user.get("organizationName", ""),
        "organizationType": user.get("organizationType", ""),
        "iat": now,
        "exp": now + timedelta(hours=Config.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise ValueError("Authentication token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid authentication token.")
