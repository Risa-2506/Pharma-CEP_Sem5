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

    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"_id": batch_id}]})
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

    data = request.get_json(silent=True) or {}
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

    if rule_doc:
        allowed_transitions = rule_doc.get("allowedTransitions", [])
        relationships = rule_doc.get("relationships", [])

        is_authorized = False

        # If explicit transitions are defined, check for strict match
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
            sender_key = Config.HARDHAT_OWNER_PRIVATE_KEY

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

    batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"_id": batch_id}]})
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


