from datetime import datetime, timezone
from bson import ObjectId
from flask import Blueprint, request, jsonify
from database import users_col, organizations_col
from auth.jwt_handler import hash_password
from auth.decorators import authority_required

user_bp = Blueprint("user_bp", __name__)


def serialize_user(user):
    if not user:
        return None
    return {
        "id": str(user["_id"]),
        "username": user.get("username"),
        "email": user.get("email"),
        "fullName": user.get("fullName", user.get("name", "")),
        "role": user.get("role"),
        "organizationId": str(user.get("organizationId", "")),
        "organizationName": user.get("organizationName", ""),
        "organizationType": user.get("organizationType", ""),
        "status": user.get("status", "Active"),
        "createdAt": user.get("createdAt", ""),
        "updatedAt": user.get("updatedAt", ""),
    }


@user_bp.route("/api/users", methods=["GET"])
@authority_required
def get_users():
    """Retrieve all users in the system (Authority only)."""
    org_id = request.args.get("organizationId")
    role = request.args.get("role")
    status = request.args.get("status")

    query = {}
    if org_id:
        query["organizationId"] = org_id
    if role:
        query["role"] = role
    if status:
        query["status"] = status

    cursor = users_col.find(query).sort("fullName", 1)
    users = [serialize_user(u) for u in cursor]

    return jsonify({"success": True, "users": users, "count": len(users)}), 200


@user_bp.route("/api/users", methods=["POST"])
@authority_required
def create_user():
    """Create a new user and assign to organization (Authority only)."""
    data = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    full_name = (data.get("fullName") or data.get("name") or "").strip()
    password = data.get("password") or "PharmaShield@2026"
    role = (data.get("role") or "").strip()
    org_id = (data.get("organizationId") or "").strip()

    if not username or not email or not full_name:
        return jsonify({
            "success": False,
            "error": "Full Name, Username, and Email are required."
        }), 400

    if not role:
        return jsonify({"success": False, "error": "Role is required."}), 400

    # Validate organization
    if not org_id:
        return jsonify({"success": False, "error": "Organization ID is required."}), 400

    try:
        oid = ObjectId(org_id)
        org = organizations_col.find_one({"_id": oid})
        if not org:
            return jsonify({"success": False, "error": "Specified organization does not exist."}), 404
    except Exception:
        return jsonify({"success": False, "error": "Invalid organization ID format."}), 400

    # Check duplicate username or email
    if users_col.find_one({"username": username}):
        return jsonify({"success": False, "error": f"Username '{username}' already exists."}), 409

    if users_col.find_one({"email": email}):
        return jsonify({"success": False, "error": f"Email '{email}' is already registered."}), 409

    now_iso = datetime.now(timezone.utc).isoformat()
    new_user = {
        "username": username,
        "email": email,
        "fullName": full_name,
        "passwordHash": hash_password(password),
        "role": role,
        "organizationId": str(org["_id"]),
        "organizationName": org["name"],
        "organizationType": org.get("type", ""),
        "status": data.get("status", "Active"),
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    res = users_col.insert_one(new_user)
    new_user["_id"] = res.inserted_id

    return jsonify({
        "success": True,
        "message": f"User '{username}' created successfully for '{org['name']}'.",
        "user": serialize_user(new_user),
    }), 201


@user_bp.route("/api/users/<user_id>/status", methods=["PATCH"])
@authority_required
def update_user_status(user_id):
    """Activate or deactivate user (Authority only)."""
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if new_status not in ["Active", "Inactive"]:
        return jsonify({"success": False, "error": "Status must be 'Active' or 'Inactive'."}), 400

    try:
        uid = ObjectId(user_id)
    except Exception:
        return jsonify({"success": False, "error": "Invalid user ID format."}), 400

    result = users_col.find_one_and_update(
        {"_id": uid},
        {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
    )

    if not result:
        return jsonify({"success": False, "error": "User not found."}), 404

    return jsonify({
        "success": True,
        "message": f"User status changed to '{new_status}'.",
        "user": serialize_user(result),
    }), 200


@user_bp.route("/api/users/<user_id>/reset-password", methods=["POST"])
@authority_required
def reset_user_password(user_id):
    """Reset a user's password (Authority only)."""
    data = request.get_json(silent=True) or {}
    new_password = data.get("newPassword", "PharmaShield@2026")

    try:
        uid = ObjectId(user_id)
    except Exception:
        return jsonify({"success": False, "error": "Invalid user ID format."}), 400

    result = users_col.find_one_and_update(
        {"_id": uid},
        {
            "$set": {
                "passwordHash": hash_password(new_password),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
        },
        return_document=True,
    )

    if not result:
        return jsonify({"success": False, "error": "User not found."}), 404

    return jsonify({
        "success": True,
        "message": f"Password reset successfully for user '{result['username']}'.",
    }), 200
