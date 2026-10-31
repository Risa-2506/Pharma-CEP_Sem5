import json
import logging
from flask import Blueprint, request, jsonify
from database import batches_col, discrepancies_col
from auth.decorators import token_required

logger = logging.getLogger(__name__)

STAGE_ETH_ACCOUNTS = {
    "Manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "Distributor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "Wholesaler": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "Retailer": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
}

STAGE_ETH_KEYS = {
    "Manufacturer": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "Distributor": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "Wholesaler": "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "Retailer": "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
}

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
        "transferHistory": batch.get("transferHistory", []),
        "verificationHistory": batch.get("verificationHistory", []),
        "receiptHistory": batch.get("receiptHistory", []),
        "dispenseHistory": batch.get("dispenseHistory", []),
        "trustedBaseline": batch.get("trustedBaseline"),
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
    """Retrieve batches list with optional view filter (inventory vs incoming)."""
    user = getattr(request, "user", {})
    query = {}
    org_id = user.get("organizationId")
    view = request.args.get("view")  # 'incoming', 'inventory', or None

    # Authority sees all batches. Other roles see batches relevant to their organization.
    if user.get("role") != "Authority":
        if view == "incoming":
            query["currentHolderId"] = org_id
            query["status"] = "In Transit"
        elif view == "inventory":
            query["currentHolderId"] = org_id
            query["status"] = {"$ne": "In Transit"}
        else:
            query["$or"] = [
                {"currentHolderId": org_id},
                {"manufacturerId": org_id},
                {"transferHistory.senderOrgId": org_id},
                {"transferHistory.receiverOrgId": org_id},
                {"transferHistory.senderOrgName": user.get("organizationName")},
                {"transferHistory.receiverOrgName": user.get("organizationName")},
            ]

    status_filter = request.args.get("status")
    if status_filter and view not in ("incoming", "inventory"):
        query["status"] = status_filter

    cursor = batches_col.find(query).sort("createdAt", -1)
    batches = [serialize_batch(b) for b in cursor]

    return jsonify({
        "success": True,
        "batches": batches,
        "count": len(batches),
    }), 200


@batch_bp.route("/api/deliveries/incoming", methods=["GET"])
@token_required
def get_incoming_deliveries():
    """Returns batches currently in transit addressed to the authenticated organization."""
    user = getattr(request, "user", {})
    org_id = user.get("organizationId")
    if not org_id:
        return jsonify({"success": False, "error": "No organization associated with user."}), 400

    query = {
        "currentHolderId": org_id,
        "status": "In Transit",
    }
    cursor = batches_col.find(query).sort("updatedAt", -1)
    deliveries = [serialize_batch(b) for b in cursor]

    return jsonify({
        "success": True,
        "deliveries": deliveries,
        "incomingDeliveries": deliveries,
        "count": len(deliveries),
    }), 200


@batch_bp.route("/api/batches/<batch_id>", methods=["GET"])
@token_required
def get_batch_details(batch_id):
    """Retrieve single batch details."""
    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
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


@batch_bp.route("/api/batches/<batch_id>/verify-scan", methods=["POST"])
@token_required
def verify_batch_stage_scan(batch_id):
    """
    Compares newly scanned package details at a supply-chain receiving stage (Distributor,
    Wholesaler, Retailer) directly against the ORIGINAL MANUFACTURER TRUSTED BASELINE.
    Computes scannedDataHash and verifies against trustedDataHash.
    Logs discrepancy if mismatch is found.
    """
    from datetime import datetime, timezone
    from services.ai_service import ai_service
    from database import discrepancies_col

    user = getattr(request, "user", {})
    user_org_id = user.get("organizationId")
    user_stage = user.get("organizationType", "Distributor")

    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
    if not batch:
        return jsonify({"success": False, "error": f"Batch '{batch_id}' not found."}), 404

    # 1. Validation of recipient
    if user.get("role") != "Authority" and batch.get("currentHolderId") != user_org_id:
        return jsonify({
            "success": False,
            "error": f"Access denied: Batch '{batch_id}' is addressed to '{batch.get('currentHolderName')}', not your organization."
        }), 403

    # 2. Blocked status check
    if batch.get("status") == "Blocked":
        return jsonify({
            "success": False,
            "error": f"CRITICAL: Batch '{batch_id}' is under REGULATORY HOLD (Blocked). Verification and receipt are disabled."
        }), 403

    data = request.get_json(silent=True) or {}
    ai_extracted = data.get("aiExtracted")
    if not ai_extracted:
        return jsonify({"success": False, "error": "AI extracted package details are required for scan verification."}), 400

    # 3. Retrieve original manufacturer baseline
    baseline = batch.get("trustedBaseline")
    if not baseline:
        baseline = ai_service.generate_trusted_baseline({
            "medicineName": batch.get("medicineName", ""),
            "batchNumber": batch.get("batchNumber", batch.get("batchId", "")),
            "manufacturerName": batch.get("manufacturerName", ""),
            "composition": batch.get("composition", ""),
            "manufacturingDate": batch.get("manufacturingDate", ""),
            "expiryDate": batch.get("expiryDate", ""),
            "quantity": str(batch.get("quantity", "")),
            "sealId": batch.get("sealId", ""),
            "mrp": batch.get("mrp", ""),
        })

    # 4. Run Stage Verification against Original Manufacturer Baseline
    verification = ai_service.verify_stage_scan(baseline, ai_extracted, current_stage=user_stage)

    # 5. If verification failed, record discrepancy in MongoDB
    if not verification.get("verified", False):
        failed_labels = ", ".join(verification.get("failedFields", []))
        discrepancy_doc = {
            "batchId": batch.get("batchId"),
            "issueType": f"{user_stage} Medicine Verification Mismatch",
            "description": f"Mismatch detected during {user_stage} receipt scan against original Manufacturer baseline on: [{failed_labels}].",
            "expected": str(baseline.get("canonicalData") or baseline),
            "actual": str(ai_extracted),
            "trustedDataHash": verification.get("trustedDataHash"),
            "scannedDataHash": verification.get("scannedDataHash"),
            "detectedBy": user.get("username", "Unknown"),
            "detectedByRole": user.get("role", "Unknown"),
            "organization": user.get("organizationName", "Unknown"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "Open",
        }
        discrepancies_col.insert_one(discrepancy_doc)

    return jsonify({
        "success": True,
        "batchId": batch.get("batchId"),
        "verification": verification,
        "originalBaseline": baseline,
        "aiExtracted": ai_extracted,
    }), 200


@batch_bp.route("/api/batches/<batch_id>/receive", methods=["POST"])
@token_required
def receive_batch(batch_id):
    """
    Confirms physical receipt & custody acceptance of an incoming delivery at a supply chain stage.
    Enforces all 13 security/business rules from Section 9.7.
    """
    from datetime import datetime, timezone
    import time
    from services.blockchain_service import blockchain_service
    from database import organizations_col
    from config import Config

    user = getattr(request, "user", {})
    user_org_id = user.get("organizationId")
    user_role = user.get("role", "")
    user_stage = user.get("organizationType", "Distributor")

    # Rule 2: Active user
    if user.get("status") and user.get("status") != "Active":
        return jsonify({"success": False, "error": "Unauthorized: User account is inactive."}), 403

    # Rule 3: Active organization
    try:
        from bson import ObjectId
        user_org = organizations_col.find_one({"_id": ObjectId(user_org_id)})
    except Exception:
        user_org = organizations_col.find_one({"$or": [{"id": user_org_id}, {"name": user.get("organizationName")}]})

    if not user_org or user_org.get("status") != "Active":
        return jsonify({"success": False, "error": "Unauthorized: Organization is inactive or unapproved."}), 403

    # Rule 4 & 5: Role and receive permissions
    allowed_stages = ["Distributor", "Wholesaler", "Retailer"]
    if user_stage not in allowed_stages and user_role != "Authority":
        return jsonify({"success": False, "error": f"Role '{user_role}' cannot receive custody."}), 403

    # Rule 6: Batch exists
    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
    if not batch:
        return jsonify({"success": False, "error": f"Batch '{batch_id}' not found."}), 404

    # Rule 10: Batch not blocked
    if batch.get("status") == "Blocked":
        return jsonify({
            "success": False,
            "error": "CRITICAL: Batch is under REGULATORY HOLD (Blocked). Receipt is strictly prohibited."
        }), 403

    # Rule 7: Intended receiver
    if user_role != "Authority" and batch.get("currentHolderId") != user_org_id:
        return jsonify({
            "success": False,
            "error": f"Receipt Error: Batch '{batch_id}' is addressed to '{batch.get('currentHolderName')}', not your organization."
        }), 403

    # Rule 9: Expected stage
    if batch.get("stage") != user_stage and user_role != "Authority":
        return jsonify({
            "success": False,
            "error": f"Stage Error: Batch is at stage '{batch.get('stage')}', but your stage is '{user_stage}'."
        }), 400

    # Rule 11: Receipt not already processed
    if batch.get("status") != "In Transit":
        return jsonify({
            "success": False,
            "error": f"Batch is not in transit (Current status: '{batch.get('status')}'). Receipt already completed or not yet dispatched."
        }), 400

    data = request.get_json(silent=True) or {}
    verification_payload = data.get("verification")
    new_seal_id = (data.get("newSealId") or batch.get("sealId") or f"SEAL-{int(time.time())}").strip()

    # Rule 12: Medicine verification passed
    if not verification_payload or not verification_payload.get("verified", False):
        return jsonify({
            "success": False,
            "error": "VERIFICATION REQUIRED: Medicine package scan verification must pass against original Manufacturer baseline before custody receipt."
        }), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    audit_entry = {
        "stage": user_stage,
        "operator": user.get("username"),
        "operatorRole": user_role,
        "organization": user.get("organizationName"),
        "timestamp": now_iso,
        "trustedDataHash": verification_payload.get("trustedDataHash"),
        "scannedDataHash": verification_payload.get("scannedDataHash"),
        "hashMatch": verification_payload.get("hashMatch", False),
        "fieldChecks": verification_payload.get("fieldChecks", {}),
        "status": "Verified",
    }

    # On-Chain Blockchain Receipt Event
    tx_hash = None
    block_num = None
    if blockchain_service.is_connected() and blockchain_service.contract:
        try:
            inspector_key = STAGE_ETH_KEYS.get(user_stage, Config.HARDHAT_OWNER_PRIVATE_KEY)
            notes = f"Receipt & Baseline Verified at {user_stage}: {user.get('organizationName')}"
            tx_res = blockchain_service.inspect_batch(
                inspector_private_key=inspector_key,
                batch_id=batch.get("batchId"),
                notes=notes,
                new_seal_id=new_seal_id,
            )
            tx_hash = tx_res.get("transactionHash")
            block_num = tx_res.get("blockNumber")
            audit_entry["blockchainTx"] = tx_hash
            audit_entry["blockNumber"] = block_num
        except Exception as e:
            logger.warning(f"Blockchain inspection logging note: {e}")

    # Atomic Update in MongoDB
    updated = batches_col.find_one_and_update(
        {"_id": batch["_id"]},
        {
            "$set": {
                "status": "Verified",
                "stage": user_stage,
                "currentHolderId": user_org_id,
                "currentHolderName": user.get("organizationName"),
                "currentHolderType": user_stage,
                "custodyStatus": "In Custody",
                "verificationStatus": "Verified",
                "lastVerifiedAt": now_iso,
                "lastVerifiedBy": user.get("username"),
                "sealId": new_seal_id,
                "updatedAt": now_iso,
            },
            "$push": {
                "verificationHistory": audit_entry,
                "receiptHistory": {
                    "stage": user_stage,
                    "organization": user.get("organizationName"),
                    "receivedBy": user.get("username"),
                    "timestamp": now_iso,
                    "sealId": new_seal_id,
                    "txHash": tx_hash,
                    "blockNumber": block_num,
                }
            }
        },
        return_document=True,
    )

    return jsonify({
        "success": True,
        "message": f"Batch '{batch.get('batchId')}' verified and received into {user_stage} inventory successfully!",
        "batch": serialize_batch(updated),
        "verificationAudit": audit_entry,
        "blockchainReceipt": {
            "transactionHash": tx_hash,
            "blockNumber": block_num,
        } if tx_hash else None,
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
    mfg_in = data.get("manufacturerInput") or {}

    medicine_name = (data.get("medicineName") or mfg_in.get("medicineName") or "").strip()
    batch_number = (data.get("batchNumber") or data.get("batchId") or mfg_in.get("batchNumber") or mfg_in.get("batchId") or "").strip()
    manufacturing_date = (data.get("manufacturingDate") or mfg_in.get("manufacturingDate") or "").strip()
    expiry_date = (data.get("expiryDate") or mfg_in.get("expiryDate") or "").strip()
    composition = (data.get("composition") or mfg_in.get("composition") or "").strip()
    quantity_raw = data.get("quantity") if data.get("quantity") is not None else mfg_in.get("quantity")
    mrp = (data.get("mrp") or mfg_in.get("mrp") or "").strip()
    seal_id = (data.get("sealId") or mfg_in.get("sealId") or "").strip()
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
        "manufacturerName": user.get("organizationName", "Licensed Manufacturer Facility"),
        "manufacturerId": user.get("organizationId", ""),
        "currentHolderName": user.get("organizationName", "Licensed Manufacturer Facility"),
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


@batch_bp.route("/api/batches/<batch_id>/transfer", methods=["POST"])
@token_required
def transfer_batch(batch_id):
    """Transfers custody of a batch to an authorized supply chain recipient."""
    from datetime import datetime, timezone
    from bson import ObjectId
    from services.blockchain_service import blockchain_service
    from database import supply_chain_rules_col, organizations_col, discrepancies_col
    from config import Config

    user = getattr(request, "user", {})
    user_org_id = user.get("organizationId", "")

    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
    if not batch:
        return jsonify({"success": False, "error": f"Batch '{batch_id}' not found."}), 404

    # 1. Check if batch is blocked
    if batch.get("status") == "Blocked":
        return jsonify({
            "success": False,
            "error": "CRITICAL: This batch is under REGULATORY HOLD (Blocked). Further custody transfer is strictly prohibited."
        }), 403

    # 2. Check current holder
    if user.get("role") != "Authority" and batch.get("currentHolderId") != user_org_id:
        return jsonify({
            "success": False,
            "error": f"Custody Error: Only the current holder '{batch.get('currentHolderName')}' can transfer this batch."
        }), 403

    # 2b. Check if batch is currently In Transit
    if batch.get("status") == "In Transit":
        return jsonify({
            "success": False,
            "error": "Custody Error: Cannot transfer a batch that is currently 'In Transit'. The receiving facility must first complete medicine scan verification and confirm receipt."
        }), 400

    data = request.get_json(silent=True) or {}
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
            if isinstance(parsed, dict):
                data = parsed
            else:
                data = {"receiverOrgId": str(parsed)}
        except Exception:
            data = {"receiverOrgId": data}
    elif not isinstance(data, dict):
        data = {}

    receiver_id = (data.get("receiverId") or data.get("receiverOrgId") or "").strip()
    new_seal_id = (data.get("newSealId") or data.get("sealId") or f"SEAL-{int(datetime.now().timestamp())}").strip()

    if not receiver_id:
        return jsonify({"success": False, "error": "Receiver organization ID is required."}), 400

    # 3. Lookup receiver organization
    try:
        rec_oid = ObjectId(receiver_id)
        receiver_org = organizations_col.find_one({"_id": rec_oid})
    except Exception:
        receiver_org = organizations_col.find_one({"$or": [{"id": receiver_id}, {"name": receiver_id}]})

    if not receiver_org:
        return jsonify({"success": False, "error": f"Target receiver organization '{receiver_id}' does not exist."}), 404

    if receiver_org.get("status") != "Active":
        return jsonify({"success": False, "error": f"Target organization '{receiver_org['name']}' is Inactive/Deactivated."}), 400

    # 4. Supply Chain Authorization Rule Validation
    rule_doc = supply_chain_rules_col.find_one({"isDefault": True})
    current_holder_name = batch.get("currentHolderName", "")
    current_stage = batch.get("stage", "Manufacturer")
    receiver_name = receiver_org.get("name", "")
    receiver_type = receiver_org.get("type", "")

    default_transitions = [
        {"from": "Manufacturer", "to": "Distributor"},
        {"from": "Distributor", "to": "Wholesaler"},
        {"from": "Wholesaler", "to": "Retailer"},
    ]
    allowed_transitions = (rule_doc.get("allowedTransitions") if rule_doc else None) or default_transitions
    relationships = rule_doc.get("relationships", []) if rule_doc else []

    is_authorized = False

    # Check for transition match
    for t in allowed_transitions:
        from_org_rule = t.get("fromOrg")
        to_org_rule = t.get("toOrg")

        from_match = (from_org_rule == current_holder_name) if from_org_rule else (t.get("from") == current_stage)
        to_match = (to_org_rule == receiver_name) if to_org_rule else (t.get("to") == receiver_type)

        if from_match and to_match:
            is_authorized = True
            break

    # If pipeline relationships are defined, check sequential partner
    if relationships:
        curr_idx = -1
        rec_idx = -1
        for idx, rel in enumerate(relationships):
            if rel.get("orgId") == batch.get("currentHolderId") or rel.get("orgName") == current_holder_name or rel.get("type") == current_stage:
                curr_idx = idx
            if str(rel.get("orgId")) == str(receiver_org.get("_id")) or rel.get("orgName") == receiver_name:
                rec_idx = idx

        if curr_idx != -1 and rec_idx == curr_idx + 1:
            is_authorized = True
        elif not is_authorized and rec_idx != curr_idx + 1:
            is_authorized = False

    if not is_authorized:
        # Log Discrepancy in MongoDB
        discrepancy_record = {
            "batchId": batch.get("batchId"),
            "issueType": "Unauthorized Transfer Attempt",
            "description": f"Attempted transfer from '{current_holder_name}' ({current_stage}) to unauthorized recipient '{receiver_name}' ({receiver_type}).",
            "expected": f"Authorized supply chain next stage partner",
            "actual": f"{receiver_name} ({receiver_type})",
            "detectedBy": user.get("username", "Unknown"),
            "detectedByRole": user.get("role", "Unknown"),
            "status": "Open",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        discrepancies_col.insert_one(discrepancy_record)

        return jsonify({
            "success": False,
            "error": f"UNAUTHORIZED TRANSFER REJECTED: '{receiver_name}' is not authorized to receive batches from '{current_holder_name}' under the active Supply Chain Rules configured by the Regulatory Authority.",
            "discrepancyLogged": True,
        }), 403

    # 5. Execute On-Chain Transfer on Blockchain
    tx_hash = None
    block_num = None
    if blockchain_service.is_connected() and blockchain_service.contract:
        try:
            # Distinct standard Hardhat participant test accounts
            STAGE_ETH_ACCOUNTS = {
                "Manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                "Distributor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "Wholesaler": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "Retailer": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            }
            receiver_eth_addr = receiver_org.get("ethAddress") or STAGE_ETH_ACCOUNTS.get(receiver_type, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
            sender_key = STAGE_ETH_KEYS.get(current_stage, Config.HARDHAT_OWNER_PRIVATE_KEY)

            tx_res = blockchain_service.transfer_batch(
                sender_private_key=sender_key,
                batch_id=batch.get("batchId"),
                receiver_address=receiver_eth_addr,
                new_seal_id=new_seal_id,
            )
            tx_hash = tx_res.get("transactionHash")
            block_num = tx_res.get("blockNumber")
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Blockchain transaction error during custody transfer: {str(e)}"
            }), 500

    # 6. Update MongoDB Batch State
    now_iso = datetime.now(timezone.utc).isoformat()
    transfer_log_entry = {
        "senderOrgId": batch.get("currentHolderId"),
        "senderOrgName": current_holder_name,
        "senderStage": current_stage,
        "receiverOrgId": str(receiver_org["_id"]),
        "receiverOrgName": receiver_name,
        "receiverStage": receiver_type,
        "previousSealId": batch.get("sealId"),
        "newSealId": new_seal_id,
        "txHash": tx_hash,
        "blockNumber": block_num,
        "transferredBy": user.get("username"),
        "timestamp": now_iso,
    }

    updated = batches_col.find_one_and_update(
        {"_id": batch["_id"]},
        {
            "$set": {
                "currentHolderId": str(receiver_org["_id"]),
                "currentHolderName": receiver_name,
                "currentHolderType": receiver_type,
                "stage": receiver_type,
                "status": "In Transit",
                "previousSealId": batch.get("sealId"),
                "sealId": new_seal_id,
                "updatedAt": now_iso,
            },
            "$push": {
                "transferHistory": transfer_log_entry,
            }
        },
        return_document=True,
    )

    return jsonify({
        "success": True,
        "message": f"Custody of batch '{batch.get('batchId')}' transferred successfully to '{receiver_name}'!",
        "batch": serialize_batch(updated),
        "transferRecord": transfer_log_entry,
        "blockchainReceipt": {
            "transactionHash": tx_hash,
            "blockNumber": block_num,
        }
    }), 200


@batch_bp.route("/api/batches/<batch_id>/blockchain", methods=["GET"])
@token_required
def get_batch_blockchain_audit(batch_id):
    """Queries live on-chain smart contract data and event logs for transparent verification."""
    from services.blockchain_service import blockchain_service

    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
    if not batch:
        return jsonify({"success": False, "error": "Batch not found."}), 404

    if not blockchain_service.is_connected():
        return jsonify({
            "success": False,
            "error": "Blockchain node is not connected. Hardhat node required to read on-chain ledger."
        }), 503

    try:
        audit_data = blockchain_service.get_batch_events(batch.get("batchId"))
        return jsonify({
            "success": True,
            "batchId": batch.get("batchId"),
            "medicineName": batch.get("medicineName"),
            "trustedDataHash": batch.get("trustedDataHash"),
            "batchFingerprint": batch.get("batchFingerprint"),
            "blockchain": audit_data,
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to read blockchain ledger: {str(e)}"}), 500


@batch_bp.route("/api/batches/<batch_id>/dispense", methods=["POST"])
@token_required
def dispense_batch(batch_id):
    """
    Dispenses medicine units to a patient at the final Pharmacy / Retailer stage.
    Completes the end-to-end supply chain verification journey.
    """
    from datetime import datetime, timezone
    from services.blockchain_service import blockchain_service
    from config import Config

    user = getattr(request, "user", {})
    user_org_id = user.get("organizationId")
    user_role = user.get("role", "")
    user_stage = user.get("organizationType", "Retailer")

    if user_stage != "Retailer" and user_role != "Authority":
        return jsonify({
            "success": False,
            "error": f"Unauthorized: Only licensed Pharmacy / Retailer participants can dispense medicine to patients (Your stage: '{user_stage}')."
        }), 403

    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
    if not batch:
        return jsonify({"success": False, "error": f"Batch '{batch_id}' not found."}), 404

    if batch.get("status") == "Blocked":
        return jsonify({
            "success": False,
            "error": "CRITICAL: Batch is under REGULATORY HOLD (Blocked). Dispensing is strictly prohibited."
        }), 403

    if user_role != "Authority" and batch.get("currentHolderId") != user_org_id:
        return jsonify({
            "success": False,
            "error": f"Custody Error: Batch '{batch_id}' is held by '{batch.get('currentHolderName')}', not your pharmacy."
        }), 403

    if batch.get("status") == "In Transit":
        return jsonify({
            "success": False,
            "error": "Cannot dispense: Batch is currently In Transit. Scan verification and receipt must be completed first."
        }), 400

    data = request.get_json(silent=True) or {}
    patient_id = (data.get("patientId") or data.get("prescriptionId") or f"PAT-{int(datetime.now().timestamp())}").strip()
    qty_to_dispense = int(data.get("dispensedQuantity") or data.get("quantity") or 1)
    notes = (data.get("notes") or f"Dispensed {qty_to_dispense} units to patient ID {patient_id}").strip()

    curr_qty = int(batch.get("quantity") or 1)
    new_qty = max(0, curr_qty - qty_to_dispense)
    new_status = "Dispensed" if new_qty == 0 else "In Custody"

    now_iso = datetime.now(timezone.utc).isoformat()
    dispense_record = {
        "dispensedAt": now_iso,
        "dispensedBy": user.get("username", "Pharmacist"),
        "patientId": patient_id,
        "dispensedQuantity": qty_to_dispense,
        "remainingQuantity": new_qty,
        "notes": notes,
        "pharmacyName": user.get("organizationName", "Authorized Pharmacy"),
    }

    # On-Chain Inspection/Dispense event
    tx_hash = None
    block_num = None
    if blockchain_service.is_connected() and blockchain_service.contract:
        try:
            retailer_key = STAGE_ETH_KEYS.get("Retailer", Config.HARDHAT_OWNER_PRIVATE_KEY)
            disp_notes = f"Dispensed {qty_to_dispense} units to patient: {patient_id}"
            tx_res = blockchain_service.inspect_batch(
                inspector_private_key=retailer_key,
                batch_id=batch.get("batchId"),
                notes=disp_notes,
                new_seal_id=batch.get("sealId", "SEAL-DISPENSED")
            )
            tx_hash = tx_res.get("transactionHash")
            block_num = tx_res.get("blockNumber")
            dispense_record["txHash"] = tx_hash
            dispense_record["blockNumber"] = block_num
        except Exception as e:
            logger.warning(f"Could not log blockchain dispense event: {e}")

    updated = batches_col.find_one_and_update(
        {"_id": batch["_id"]},
        {
            "$set": {
                "quantity": new_qty,
                "status": new_status,
                "updatedAt": now_iso,
            },
            "$push": {
                "dispenseHistory": dispense_record,
            }
        },
        return_document=True
    )

    return jsonify({
        "success": True,
        "message": f"Successfully dispensed {qty_to_dispense} units to patient {patient_id}!",
        "batch": serialize_batch(updated),
        "dispenseRecord": dispense_record,
        "blockchainReceipt": {
            "transactionHash": tx_hash,
            "blockNumber": block_num,
        }
    }), 200


