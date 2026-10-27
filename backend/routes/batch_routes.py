from flask import Blueprint, request, jsonify
from database import batches_col, discrepancies_col
from auth.decorators import token_required

batch_bp = Blueprint("batch_bp", __name__)


def serialize_batch(batch):
    if not batch:
        return None
    return {
        "id": str(batch["_id"]),
        "batchId": batch.get("batchId"),
        "medicineName": batch.get("medicineName"),
        "batchNumber": batch.get("batchNumber"),
        "manufacturerName": batch.get("manufacturerName"),
        "manufacturerId": batch.get("manufacturerId"),
        "currentHolderName": batch.get("currentHolderName"),
        "currentHolderId": batch.get("currentHolderId"),
        "currentHolderType": batch.get("currentHolderType"),
        "stage": batch.get("stage", "Manufacturer"),
        "status": batch.get("status", "Registered"),
        "quantity": batch.get("quantity"),
        "manufacturingDate": batch.get("manufacturingDate"),
        "expiryDate": batch.get("expiryDate"),
        "composition": batch.get("composition"),
        "sealId": batch.get("sealId"),
        "trustedDataHash": batch.get("trustedDataHash"),
        "batchFingerprint": batch.get("batchFingerprint"),
        "blockchainTx": batch.get("blockchainTx"),
        "blockNumber": batch.get("blockNumber"),
        "contractAddress": batch.get("contractAddress"),
        "verificationStatus": batch.get("verificationStatus", "Verified"),
        "createdAt": batch.get("createdAt"),
        "updatedAt": batch.get("updatedAt"),
    }


@batch_bp.route("/api/batches/summary", methods=["GET"])
@token_required
def get_batch_summary():
    """Retrieve operational dashboard metric counters."""
    user = getattr(request, "user", {})
    query = {}

    # If non-authority, filter by organization
    if user.get("role") != "Authority":
        org_id = user.get("organizationId")
        query["$or"] = [
            {"currentHolderId": org_id},
            {"manufacturerId": org_id},
        ]

    total_active = batches_col.count_documents({**query, "status": {"$ne": "Archived"}})
    in_transit = batches_col.count_documents({**query, "status": "In Transit"})
    verified = batches_col.count_documents({**query, "verificationStatus": "Verified"})
    blocked = batches_col.count_documents({**query, "status": "Blocked"})
    discrepancies = discrepancies_col.count_documents({"status": "Open"})

    return jsonify({
        "success": True,
        "metrics": {
            "totalActive": total_active,
            "inTransit": in_transit,
            "verified": verified,
            "discrepancies": discrepancies,
            "blocked": blocked,
        }
    }), 200


@batch_bp.route("/api/batches", methods=["GET"])
@token_required
def get_batches():
    """Retrieve batches list."""
    user = getattr(request, "user", {})
    query = {}

    # Authority sees all batches. Other roles see batches relevant to their organization.
    if user.get("role") != "Authority":
        org_id = user.get("organizationId")
        query["$or"] = [
            {"currentHolderId": org_id},
            {"manufacturerId": org_id},
        ]

    status_filter = request.args.get("status")
    if status_filter:
        query["status"] = status_filter

    cursor = batches_col.find(query).sort("createdAt", -1)
    batches = [serialize_batch(b) for b in cursor]

    return jsonify({
        "success": True,
        "batches": batches,
        "count": len(batches),
    }), 200


@batch_bp.route("/api/batches/<batch_id>", methods=["GET"])
@token_required
def get_batch_details(batch_id):
    """Retrieve single batch details."""
    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"_id": batch_id}]})
    if not batch:
        return jsonify({"success": False, "error": "Batch not found."}), 404

    return jsonify({
        "success": True,
        "batch": serialize_batch(batch),
    }), 200
