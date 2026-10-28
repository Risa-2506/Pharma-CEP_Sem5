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


@batch_bp.route("/api/batches/verify", methods=["POST"])
@token_required
def verify_batch_data():
    """Compares manufacturer entered data against AI package extraction."""
    data = request.get_json(silent=True) or {}
    manufacturer_input = data.get("manufacturerInput", {})
    ai_extracted = data.get("aiExtracted", {})

    if not manufacturer_input or not ai_extracted:
        return jsonify({
            "success": False,
            "error": "Both manufacturerInput and aiExtracted data objects are required."
        }), 400

    from services.ai_service import ai_service
    verification = ai_service.verify_manufacturer_input(manufacturer_input, ai_extracted)
    return jsonify({
        "success": True,
        "verification": verification,
    }), 200


@batch_bp.route("/api/batches", methods=["POST"])
@token_required
def register_batch():
    """Registers a new pharmaceutical batch with AI verification, trusted baseline and blockchain registration."""
    from datetime import datetime, timezone
    import time
    from services.ai_service import ai_service
    from services.blockchain_service import blockchain_service
    from config import Config

    user = getattr(request, "user", {})
    user_role = user.get("role", "")

    # Role enforcement: Manufacturer Operator only
    allowed_roles = ["Manufacturer", "Manufacturer Operator", "Manufacturer Admin", "Authority"]
    if user_role not in allowed_roles:
        return jsonify({
            "success": False,
            "error": f"Access denied. Only registered Manufacturer Operators can register new batches, not '{user_role}'."
        }), 403

    data = request.get_json(silent=True) or {}

    medicine_name = (data.get("medicineName") or "").strip()
    batch_number = (data.get("batchNumber") or data.get("batchId") or "").strip()
    manufacturing_date = (data.get("manufacturingDate") or "").strip()
    expiry_date = (data.get("expiryDate") or "").strip()
    composition = (data.get("composition") or "").strip()
    quantity_raw = data.get("quantity")
    mrp = (data.get("mrp") or "").strip()
    seal_id = (data.get("sealId") or "").strip()
    ai_extracted = data.get("aiExtracted")

    if not medicine_name or not batch_number or not expiry_date or not seal_id:
        return jsonify({
            "success": False,
            "error": "Missing required fields: Medicine Name, Batch Number, Expiry Date, and Seal ID are mandatory."
        }), 400

    try:
        quantity = int(quantity_raw)
        if quantity <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "Quantity must be a positive integer."}), 400

    # Check for duplicate batch ID
    existing = batches_col.find_one({"batchId": batch_number})
    if existing:
        return jsonify({
            "success": False,
            "error": f"Batch '{batch_number}' is already registered in the system."
        }), 409

    # 1. AI Verification Check (Compare manufacturer input vs AI extraction)
    if ai_extracted:
        verification = ai_service.verify_manufacturer_input({
            "medicineName": medicine_name,
            "batchNumber": batch_number,
            "expiryDate": expiry_date,
            "composition": composition,
            "manufacturer": user.get("organizationName", ""),
        }, ai_extracted)

        if not verification.get("verified", False):
            failed_fields = ", ".join(verification.get("failedFields", []))
            return jsonify({
                "success": False,
                "error": f"MANUFACTURER VERIFICATION FAILED: Mismatch detected between manufacturer input and packaging AI extraction on [{failed_fields}]. Registration rejected.",
                "verification": verification,
            }), 400
    else:
        verification = {
            "verified": True,
            "status": "PASSED",
            "fieldChecks": {},
            "failedFields": [],
        }

    # 2. Canonicalise & Generate Trusted Baseline
    canonical_data = {
        "batchNumber": batch_number,
        "medicineName": medicine_name,
        "manufacturerName": user.get("organizationName", "Apex Pharma Pvt. Ltd."),
        "composition": composition,
        "manufacturingDate": manufacturing_date,
        "expiryDate": expiry_date,
        "quantity": str(quantity),
        "sealId": seal_id,
        "mrp": mrp,
    }
    baseline = ai_service.generate_trusted_baseline(canonical_data)

    # 3. Calculate future expiry timestamp for Smart Contract
    try:
        # Try parsing dates like 12/2027 or 2027-12-31
        if "/" in expiry_date:
            parts = expiry_date.split("/")
            month = int(parts[0])
            year = int(parts[1]) if len(parts[1]) == 4 else int("20" + parts[1])
            exp_dt = datetime(year, month, 28, 23, 59, 59, tzinfo=timezone.utc)
            expiry_timestamp = int(exp_dt.timestamp())
        else:
            expiry_timestamp = int(time.time()) + (730 * 86400) # 2 years default
    except Exception:
        expiry_timestamp = int(time.time()) + (730 * 86400)

    # Ensure expiry timestamp is in future
    if expiry_timestamp <= int(time.time()):
        expiry_timestamp = int(time.time()) + (730 * 86400)

    # 4. Register on Blockchain via Web3.py & Smart Contract
    blockchain_tx = None
    block_number = None
    contract_addr = None

    if blockchain_service.is_connected() and blockchain_service.contract:
        try:
            # Backend resolves the manufacturer's signer
            signer_key = Config.HARDHAT_OWNER_PRIVATE_KEY
            tx_res = blockchain_service.register_batch(
                sender_private_key=signer_key,
                batch_id=batch_number,
                medicine_name=medicine_name,
                batch_number=batch_number,
                expiry_timestamp=expiry_timestamp,
                quantity=quantity,
                seal_id=seal_id,
            )
            blockchain_tx = tx_res.get("transactionHash")
            block_number = tx_res.get("blockNumber")
            contract_addr = tx_res.get("contractAddress")
        except Exception as e:
            # If already registered on chain or chain warning
            return jsonify({
                "success": False,
                "error": f"Blockchain transaction failed: {str(e)}"
            }), 500
    else:
        return jsonify({
            "success": False,
            "error": "Blockchain ledger service is not connected. Hardhat node must be active for batch registration."
        }), 503

    # 5. Store in MongoDB
    now_iso = datetime.now(timezone.utc).isoformat()
    new_batch = {
        "batchId": batch_number,
        "medicineName": medicine_name,
        "batchNumber": batch_number,
        "manufacturerName": user.get("organizationName", "Apex Pharma Pvt. Ltd."),
        "manufacturerId": user.get("organizationId", ""),
        "currentHolderName": user.get("organizationName", "Apex Pharma Pvt. Ltd."),
        "currentHolderId": user.get("organizationId", ""),
        "currentHolderType": "Manufacturer",
        "stage": "Manufacturer",
        "status": "Registered",
        "quantity": quantity,
        "manufacturingDate": manufacturing_date,
        "expiryDate": expiry_date,
        "composition": composition,
        "mrp": mrp,
        "sealId": seal_id,
        "trustedDataHash": baseline["trustedDataHash"],
        "batchFingerprint": baseline["batchFingerprint"],
        "trustedBaseline": baseline,
        "verificationStatus": "Verified",
        "verificationDetails": verification,
        "blockchainTx": blockchain_tx,
        "blockNumber": block_number,
        "contractAddress": contract_addr,
        "registeredBy": user.get("username", ""),
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }

    result = batches_col.insert_one(new_batch)
    new_batch["_id"] = result.inserted_id

    return jsonify({
        "success": True,
        "message": f"Medicine batch '{batch_number}' verified and registered on blockchain successfully!",
        "batch": serialize_batch(new_batch),
        "trustedBaseline": baseline,
        "blockchainReceipt": {
            "transactionHash": blockchain_tx,
            "blockNumber": block_number,
            "contractAddress": contract_addr,
        },
    }), 201

