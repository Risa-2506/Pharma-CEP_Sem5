from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from database import supply_chain_rules_col
from auth.decorators import token_required, authority_required

supply_chain_bp = Blueprint("supply_chain_bp", __name__)

DEFAULT_STAGES = [
    {"stage": "Manufacturer", "order": 1, "description": "Batch creation, packaging & initial AI verification"},
    {"stage": "Distributor", "order": 2, "description": "Bulk receiving, scan verification & onward dispatch"},
    {"stage": "Wholesaler", "order": 3, "description": "Regional transit hub receiving & verification"},
    {"stage": "Retailer", "order": 4, "description": "Final pharmacy point-of-dispense verification"},
]


@supply_chain_bp.route("/api/supply-chain/rules", methods=["GET"])
@token_required
def get_supply_chain_rules():
    """Retrieve current supply chain routes and configuration."""
    rule_doc = supply_chain_rules_col.find_one({"isDefault": True})

    if not rule_doc:
        # Return default stage template
        return jsonify({
            "success": True,
            "rules": {
                "name": "Standard Pharmaceutical Distribution Route",
                "stages": DEFAULT_STAGES,
                "relationships": [],
                "isDefault": True,
                "updatedAt": None,
            }
        }), 200

    return jsonify({
        "success": True,
        "rules": {
            "id": str(rule_doc["_id"]),
            "name": rule_doc.get("name", "Standard Pharmaceutical Distribution Route"),
            "stages": rule_doc.get("stages", DEFAULT_STAGES),
            "relationships": rule_doc.get("relationships", []),
            "allowedTransitions": rule_doc.get("allowedTransitions", [
                {"from": "Manufacturer", "to": "Distributor"},
                {"from": "Distributor", "to": "Wholesaler"},
                {"from": "Wholesaler", "to": "Retailer"},
            ]),
            "isDefault": True,
            "updatedAt": rule_doc.get("updatedAt"),
        }
    }), 200


@supply_chain_bp.route("/api/supply-chain/rules", methods=["POST"])
@authority_required
def update_supply_chain_rules():
    """Update supply chain rules and organization mappings (Authority only)."""
    data = request.get_json(silent=True) or {}

    name = data.get("name", "Standard Pharmaceutical Distribution Route")
    stages = data.get("stages", DEFAULT_STAGES)
    relationships = data.get("relationships", [])
    allowed_transitions = data.get("allowedTransitions", [
        {"from": "Manufacturer", "to": "Distributor"},
        {"from": "Distributor", "to": "Wholesaler"},
        {"from": "Wholesaler", "to": "Retailer"},
    ])

    now_iso = datetime.now(timezone.utc).isoformat()

    doc = supply_chain_rules_col.find_one_and_update(
        {"isDefault": True},
        {
            "$set": {
                "name": name,
                "stages": stages,
                "relationships": relationships,
                "allowedTransitions": allowed_transitions,
                "isDefault": True,
                "updatedAt": now_iso,
            }
        },
        upsert=True,
        return_document=True,
    )

    return jsonify({
        "success": True,
        "message": "Supply chain configuration saved successfully.",
        "rules": {
            "id": str(doc["_id"]),
            "name": doc.get("name"),
            "stages": doc.get("stages"),
            "relationships": doc.get("relationships"),
            "allowedTransitions": doc.get("allowedTransitions"),
            "updatedAt": doc.get("updatedAt"),
        }
    }), 200
