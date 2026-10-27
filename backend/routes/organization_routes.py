from datetime import datetime, timezone
from bson import ObjectId
from flask import Blueprint, request, jsonify
from database import organizations_col
from auth.decorators import token_required, authority_required

org_bp = Blueprint("org_bp", __name__)


def serialize_org(org):
    if not org:
        return None
    return {
        "id": str(org["_id"]),
        "name": org.get("name"),
        "code": org.get("code", ""),
        "type": org.get("type"),
        "status": org.get("status", "Active"),
        "address": org.get("address", ""),
        "contactEmail": org.get("contactEmail", ""),
        "contactPhone": org.get("contactPhone", ""),
        "contactPerson": org.get("contactPerson", ""),
        "createdAt": org.get("createdAt", ""),
        "updatedAt": org.get("updatedAt", ""),
    }


@org_bp.route("/api/organizations", methods=["GET"])
@token_required
def get_organizations():
    """Retrieve all organizations or filter by type/status."""
    org_type = request.args.get("type")
    status = request.args.get("status")

    query = {}
    if org_type:
        query["type"] = org_type
    if status:
        query["status"] = status

    cursor = organizations_col.find(query).sort("name", 1)
    orgs = [serialize_org(doc) for doc in cursor]

    return jsonify({"success": True, "organizations": orgs, "count": len(orgs)}), 200


@org_bp.route("/api/organizations", methods=["POST"])
@authority_required
def create_organization():
    """Create a new organization (Authority only)."""
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    org_type = (data.get("type") or "").strip()

    if not name:
        return jsonify({"success": False, "error": "Organization name is required."}), 400

    valid_types = ["Manufacturer", "Distributor", "Wholesaler", "Retailer", "Authority"]
    if org_type not in valid_types:
        return jsonify({
            "success": False,
            "error": f"Invalid organization type '{org_type}'. Allowed: {', '.join(valid_types)}."
        }), 400

    # Check for duplicate
    existing = organizations_col.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        return jsonify({
            "success": False,
            "error": f"An organization named '{name}' already exists."
        }), 409

    now_iso = datetime.now(timezone.utc).isoformat()
    new_org = {
        "name": name,
        "code": (data.get("code") or name[:4].upper()).strip(),
        "type": org_type,
        "status": data.get("status", "Active"),
        "address": (data.get("address") or "").strip(),
        "contactEmail": (data.get("contactEmail") or "").strip().lower(),
        "contactPhone": (data.get("contactPhone") or "").strip(),
        "contactPerson": (data.get("contactPerson") or "").strip(),
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    result = organizations_col.insert_one(new_org)
    new_org["_id"] = result.inserted_id

    return jsonify({
        "success": True,
        "message": f"Organization '{name}' created successfully.",
        "organization": serialize_org(new_org),
    }), 201


@org_bp.route("/api/organizations/<org_id>/status", methods=["PATCH"])
@authority_required
def update_organization_status(org_id):
    """Activate or deactivate organization (Authority only)."""
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if new_status not in ["Active", "Inactive"]:
        return jsonify({"success": False, "error": "Status must be 'Active' or 'Inactive'."}), 400

    try:
        oid = ObjectId(org_id)
    except Exception:
        return jsonify({"success": False, "error": "Invalid organization ID format."}), 400

    result = organizations_col.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc).isoformat()}},
        return_document=True,
    )

    if not result:
        return jsonify({"success": False, "error": "Organization not found."}), 404

    return jsonify({
        "success": True,
        "message": f"Organization status updated to '{new_status}'.",
        "organization": serialize_org(result),
    }), 200
