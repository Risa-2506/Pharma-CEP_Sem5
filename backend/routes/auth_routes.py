from flask import Blueprint, request, jsonify
from bson import ObjectId
from database import users_col
from auth.jwt_handler import verify_password, create_access_token
from auth.decorators import token_required

auth_bp = Blueprint("auth_bp", __name__)


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("username") or data.get("email") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({
            "success": False,
            "error": "Username/Email and Password are required."
        }), 400

    # Find user by username or email
    user = users_col.find_one({
        "$or": [
            {"username": identifier},
            {"email": identifier.lower()},
        ]
    })

    if not user:
        return jsonify({
            "success": False,
            "error": "Invalid credentials. User not found."
        }), 401

    if user.get("status") != "Active":
        return jsonify({
            "success": False,
            "error": "Account is inactive. Please contact your system administrator or Regulatory Authority."
        }), 403

    if not verify_password(password, user.get("passwordHash", "")):
        return jsonify({
            "success": False,
            "error": "Invalid credentials. Password incorrect."
        }), 401

    token = create_access_token(user)

    user_profile = {
        "id": str(user["_id"]),
        "username": user.get("username"),
        "email": user.get("email"),
        "fullName": user.get("fullName", user.get("name", "")),
        "role": user.get("role"),
        "organizationId": str(user.get("organizationId", "")),
        "organizationName": user.get("organizationName", ""),
        "organizationType": user.get("organizationType", ""),
        "status": user.get("status", "Active"),
    }

    return jsonify({
        "success": True,
        "token": token,
        "user": user_profile,
        "message": f"Welcome back, {user_profile['fullName'] or user_profile['username']}!"
    }), 200


@auth_bp.route("/api/auth/me", methods=["GET"])
@token_required
def get_current_user():
    user = getattr(request, "user", None)
    if not user:
        return jsonify({"success": False, "error": "User not found in context"}), 404

    # Fetch latest profile from DB
    try:
        db_user = users_col.find_one({"_id": ObjectId(user.get("userId"))})
        if db_user:
            return jsonify({
                "success": True,
                "user": {
                    "id": str(db_user["_id"]),
                    "username": db_user.get("username"),
                    "email": db_user.get("email"),
                    "fullName": db_user.get("fullName", db_user.get("name", "")),
                    "role": db_user.get("role"),
                    "organizationId": str(db_user.get("organizationId", "")),
                    "organizationName": db_user.get("organizationName", ""),
                    "organizationType": db_user.get("organizationType", ""),
                    "status": db_user.get("status", "Active"),
                }
            }), 200
    except Exception:
        pass

    return jsonify({"success": True, "user": user}), 200
