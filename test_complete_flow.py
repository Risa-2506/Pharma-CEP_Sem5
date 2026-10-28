import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

def req(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"error": err_body}

def run_tests():
    print("=" * 60)
    print("PHARMASHIELD AI: END-TO-END VERIFICATION SUITE")
    print("=" * 60)

    # 0. Clean reset non-authority collections to start fresh
    sys.path.insert(0, "backend")
    from database import batches_col, organizations_col, users_col, supply_chain_rules_col, discrepancies_col
    batches_col.delete_many({})
    discrepancies_col.delete_many({})
    supply_chain_rules_col.delete_many({})
    organizations_col.delete_many({"type": {"$ne": "Authority"}})
    users_col.delete_many({"role": {"$ne": "Authority"}})
    print("[OK] Fresh MongoDB state established.")

    # 1. Health & Blockchain Check
    status, health = req("/api/health")
    assert status == 200, f"Health check failed: {health}"
    assert health["blockchain"]["connected"] is True, "Blockchain not connected!"
    print(f"[OK] Blockchain Connected: {health['blockchain']['contractAddress']}")

    # 2. Authority Login
    status, login_res = req("/api/auth/login", method="POST", data={
        "username": "authority_admin",
        "password": "Admin@123"
    })
    assert status == 200, f"Authority login failed: {login_res}"
    auth_token = login_res["token"]
    print(f"[OK] Authority Login Successful. Role: {login_res['user']['role']}")

    # 3. Create Organizations: Manufacturer & Distributor
    status, mfg_res = req("/api/organizations", method="POST", token=auth_token, data={
        "name": "Sunshine Pharma Ltd.",
        "type": "Manufacturer",
        "code": "SUNS",
        "address": "Baddi Industrial Estate, Himachal Pradesh",
        "contactPerson": "Dr. R. K. Sunshine",
        "contactEmail": "ops@sunshinepharma.com",
        "contactPhone": "+91 98765 11111",
        "status": "Active"
    })
    assert status == 201, f"Failed to create Manufacturer: {mfg_res}"
    mfg_id = mfg_res["organization"]["id"]
    mfg_name = mfg_res["organization"]["name"]
    print(f"[OK] Created Manufacturer: {mfg_name} (ID: {mfg_id})")

    status, dist_res = req("/api/organizations", method="POST", token=auth_token, data={
        "name": "ABC Distributors",
        "type": "Distributor",
        "code": "ABCD",
        "address": "Sector 18 Warehouse Complex, Gurgaon",
        "contactPerson": "A. B. Chawla",
        "contactEmail": "contact@abcdist.com",
        "contactPhone": "+91 98765 22222",
        "status": "Active"
    })
    assert status == 201, f"Failed to create Distributor: {dist_res}"
    dist_id = dist_res["organization"]["id"]
    dist_name = dist_res["organization"]["name"]
    print(f"[OK] Created Distributor: {dist_name} (ID: {dist_id})")

    # Also create an unauthorized distributor to test restriction
    status, rogue_dist_res = req("/api/organizations", method="POST", token=auth_token, data={
        "name": "Rogue Non-Authorized Distributor",
        "type": "Distributor",
        "code": "ROGU",
        "address": "Unknown Alley, City X",
        "contactPerson": "Mr. Fake",
        "contactEmail": "fake@unauthorized.com",
        "contactPhone": "+91 90000 00000",
        "status": "Active"
    })
    rogue_dist_id = rogue_dist_res["organization"]["id"]
    print(f"[OK] Created Secondary Distributor for Restriction Testing: {rogue_dist_id}")

    # 4. Configure Authority Supply Chain Rule: Sunshine Pharma -> ABC Distributors ONLY
    status, rule_res = req("/api/supply-chain/rules", method="POST", token=auth_token, data={
        "name": "National Standard Pharma Distribution Route",
        "description": "Standard CDSCO regulated route from Sunshine Pharma to ABC Distributors",
        "allowedTransitions": [
            {"from": "Manufacturer", "to": "Distributor", "fromOrg": mfg_name, "toOrg": dist_name},
            {"from": "Distributor", "to": "Wholesaler"},
            {"from": "Wholesaler", "to": "Retailer"}
        ],
        "relationships": [
            {"orgId": mfg_id, "orgName": mfg_name, "type": "Manufacturer"},
            {"orgId": dist_id, "orgName": dist_name, "type": "Distributor"}
        ],
        "isDefault": True
    })
    assert status in [200, 201], f"Failed to update supply chain rules: {rule_res}"
    print(f"[OK] Configured Supply Chain Route Rule: {mfg_name} -> {dist_name}")

    # 5. Create Manufacturer User
    status, user_res = req("/api/users", method="POST", token=auth_token, data={
        "fullName": "Suresh Sharma",
        "username": "suresh_sunshine",
        "email": "suresh@sunshinepharma.com",
        "password": "Password@123",
        "organizationId": mfg_id,
        "role": "Manufacturer Operator"
    })
    assert status == 201, f"Failed to create user: {user_res}"
    print(f"[OK] Created Operator: suresh_sunshine (Sunshine Pharma Ltd.)")

    # 6. Operator Login (Transport App flow)
    status, op_login = req("/api/auth/login", method="POST", data={
        "username": "suresh_sunshine",
        "password": "Password@123"
    })
    assert status == 200, f"Operator login failed: {op_login}"
    op_token = op_login["token"]
    print(f"[OK] Operator Authenticated into Transport App")

    import time
    test_batch_no = f"SUN-AMX-{int(time.time())}"

    # 7. Package Scan & Verification
    mfg_input = {
        "medicineName": "Amoxicillin 500mg Capsules",
        "batchNumber": test_batch_no,
        "manufacturingDate": "01/2026",
        "expiryDate": "06/2028",
        "composition": "Amoxicillin Trihydrate 500 mg",
        "quantity": "25000",
        "mrp": "₹140",
        "sealId": "SEAL-SUN-001"
    }
    ai_extracted = {
        "medicineName": "Amoxicillin 500mg Capsules",
        "manufacturer": mfg_name,
        "batchNumber": test_batch_no,
        "manufacturingDate": "01/2026",
        "expiryDate": "06/2028",
        "composition": "Amoxicillin Trihydrate 500 mg",
        "quantity": "25000",
        "mrp": "₹140",
        "sealId": "SEAL-SUN-001"
    }
    status, verify_res = req("/api/batches/verify", method="POST", token=op_token, data={
        "manufacturerInput": mfg_input,
        "aiExtracted": ai_extracted
    })
    assert status == 200, f"Verification failed: {verify_res}"
    v_data = verify_res.get("verification", {})
    assert v_data.get("verified") is True, f"Verification verified is false: {v_data}"
    print(f"[OK] AI Packaging Verification Succeeded. Confidence: {v_data.get('confidence')}")

    # 8. Blockchain Batch Registration
    status, reg_res = req("/api/batches", method="POST", token=op_token, data={
        "medicineName": mfg_input["medicineName"],
        "batchNumber": mfg_input["batchNumber"],
        "manufacturingDate": mfg_input["manufacturingDate"],
        "expiryDate": mfg_input["expiryDate"],
        "composition": mfg_input["composition"],
        "quantity": int(mfg_input["quantity"]),
        "mrp": mfg_input["mrp"],
        "sealId": mfg_input["sealId"],
        "aiExtracted": ai_extracted
    })
    assert status == 201, f"Batch registration failed: {reg_res}"
    batch_id = reg_res["batch"]["batchId"]
    block_num = reg_res["blockchainReceipt"]["blockNumber"]
    tx_hash = reg_res["blockchainReceipt"]["transactionHash"]
    print(f"[OK] Batch Registered on Hardhat Blockchain! Batch ID: {batch_id}, Block: #{block_num}, Tx: {tx_hash}")

    # 9. Test Unauthorized Transfer Rejection (Transfer to rogue distributor)
    status, unauth_res = req(f"/api/batches/{batch_id}/transfer", method="POST", token=op_token, data={
        "receiverId": rogue_dist_id,
        "newSealId": "SEAL-TR-ROGUE"
    })
    assert status == 403, f"Expected 403 for unauthorized transfer, got {status}: {unauth_res}"
    print(f"[OK] SECURE: Unauthorized transfer to '{rogue_dist_id}' correctly REJECTED with 403 Forbidden!")
    print(f"      Backend rejection message: {unauth_res.get('error')}")

    # 10. Execute Authorized Custody Transfer: Sunshine Pharma -> ABC Distributors
    status, trans_res = req(f"/api/batches/{batch_id}/transfer", method="POST", token=op_token, data={
        "receiverId": dist_id,
        "newSealId": "SEAL-TR-9001"
    })
    assert status == 200, f"Authorized transfer failed: {trans_res}"
    t_block = trans_res["blockchainReceipt"]["blockNumber"]
    t_tx = trans_res["blockchainReceipt"]["transactionHash"]
    print(f"[OK] Custody Transferred on Blockchain to {dist_name}! Block: #{t_block}, Tx: {t_tx}")

    # 11. Verify Batch Live State in MongoDB
    status, batch_get = req(f"/api/batches/{batch_id}", token=auth_token)
    assert status == 200
    b = batch_get["batch"]
    assert b["stage"] == "Distributor", f"Expected stage Distributor, got {b['stage']}"
    assert b["status"] == "In Transit", f"Expected status In Transit, got {b['status']}"
    assert b["currentHolderName"] == dist_name
    print(f"[OK] Live Custody Monitor Verified: Holder = {b['currentHolderName']}, Stage = {b['stage']}, Status = {b['status']}")

    # 12. Verify Blockchain Events Inspection (Audit API)
    status, audit_res = req(f"/api/batches/{batch_id}/blockchain", token=auth_token)
    assert status == 200, f"Audit failed: {audit_res}"
    events = audit_res["blockchain"]["events"]
    print(f"[OK] Query On-Chain Blockchain Events for '{batch_id}': Found {len(events)} real EVM events!")
    for idx, ev in enumerate(events):
        print(f"      [{idx+1}] Event: {ev['event']} | Block: #{ev['blockNumber']} | Tx: {ev['transactionHash']}")
        print(f"          Decoded Args: {ev['args']}")

    print("=" * 60)
    print("ALL 12 END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
