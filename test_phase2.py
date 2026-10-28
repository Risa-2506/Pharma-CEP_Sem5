import sys
import os
import time

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app import app
from database import batches_col, users_col, organizations_col
from services.blockchain_service import blockchain_service


def test_phase_2():
    print("========================================")
    print("RUNNING PHARMASHIELD AI - PHASE 2 TESTS")
    print("========================================")

    client = app.test_client()

    # ----------------------------------------------------
    # TEST 1: Manufacturer Login
    # ----------------------------------------------------
    print("\n[TEST 1] Testing Manufacturer operator login (Aarav Sharma)...")
    mfg_login = client.post("/api/auth/login", json={
        "username": "aarav_apex",
        "password": "Password@123"
    })
    assert mfg_login.status_code == 200, f"Manufacturer login failed: {mfg_login.get_json()}"
    mfg_data = mfg_login.get_json()
    assert mfg_data["success"] is True, "Login success was not True"
    assert mfg_data["user"]["role"] == "Manufacturer Operator", "User role mismatch"
    assert mfg_data["user"]["organizationName"] == "Apex Pharma Pvt. Ltd.", "Org mismatch"
    mfg_token = mfg_data["token"]
    mfg_headers = {"Authorization": f"Bearer {mfg_token}"}
    print(f"  [PASS] Logged in as: {mfg_data['user']['fullName']} (@{mfg_data['user']['username']})")
    print(f"  [PASS] Organization: {mfg_data['user']['organizationName']} ({mfg_data['user']['role']})")

    # ----------------------------------------------------
    # TEST 2: AI Verification Failure Rejection (Negative test)
    # ----------------------------------------------------
    print("\n[TEST 2] Testing AI Verification Failure (Manufacturer Input != AI Extraction)...")
    # Clean up any leftover test batch if exists
    batches_col.delete_many({"batchId": "APX-PAN-24001"})

    mismatched_payload = {
        "medicineName": "Pantoprazole 40 mg Tablets",
        "batchNumber": "APX-PAN-24001",
        "manufacturingDate": "01/2026",
        "expiryDate": "12/2027",
        "composition": "Pantoprazole 40 mg",
        "quantity": 10000,
        "mrp": "₹120",
        "sealId": "SEAL-APX-001",
        "aiExtracted": {
            "medicineName": "Pantoprazole 40 mg Tablets",
            "manufacturer": "Apex Pharma Pvt. Ltd.",
            "composition": "Pantoprazole 40 mg",
            "batchNumber": "APX-FAKE-99999",  # MISMATCH!
            "expiryDate": "05/2025",          # MISMATCH!
        }
    }

    fail_res = client.post("/api/batches", headers=mfg_headers, json=mismatched_payload)
    assert fail_res.status_code == 400, f"Expected 400 Bad Request, got {fail_res.status_code}"
    fail_data = fail_res.get_json()
    assert fail_data["success"] is False, "Registration should have failed"
    assert "FAILED" in fail_data["error"] or "Mismatch" in fail_data["error"], "Expected mismatch error message"
    print(f"  [PASS] Correctly rejected mismatched batch: {fail_data['error']}")

    # Verify no batch was inserted in MongoDB
    assert batches_col.find_one({"batchId": "APX-PAN-24001"}) is None, "Batch should not be in MongoDB after failure"
    print("  [PASS] Confirmed: No batch was written to MongoDB on verification failure.")

    # ----------------------------------------------------
    # TEST 3: Positive AI Verification & Trusted Baseline Generation
    # ----------------------------------------------------
    print("\n[TEST 3] Testing AI Verification Endpoint /api/batches/verify...")
    valid_ai_extraction = {
        "medicineName": "Pantoprazole 40 mg Tablets",
        "manufacturer": "Apex Pharma Pvt. Ltd.",
        "composition": "Pantoprazole 40 mg",
        "batchNumber": "APX-PAN-24001",
        "manufacturingDate": "01/2026",
        "expiryDate": "12/2027",
        "mrp": "₹120",
    }

    verify_check = client.post("/api/batches/verify", headers=mfg_headers, json={
        "manufacturerInput": {
            "medicineName": "Pantoprazole 40 mg Tablets",
            "batchNumber": "APX-PAN-24001",
            "expiryDate": "12/2027",
            "composition": "Pantoprazole 40 mg",
            "manufacturer": "Apex Pharma Pvt. Ltd.",
        },
        "aiExtracted": valid_ai_extraction
    })
    assert verify_check.status_code == 200
    v_data = verify_check.get_json()["verification"]
    assert v_data["verified"] is True, "Expected verified to be True"
    assert v_data["status"] == "PASSED", f"Expected PASSED, got {v_data['status']}"
    print("  [PASS] AI Verification PASSED with 100% field match!")

    # ----------------------------------------------------
    # TEST 4: Full Batch Creation with Blockchain Registration
    # ----------------------------------------------------
    print("\n[TEST 4] Registering new batch APX-PAN-24001 on Blockchain & MongoDB...")
    valid_payload = {
        "medicineName": "Pantoprazole 40 mg Tablets",
        "batchNumber": "APX-PAN-24001",
        "manufacturingDate": "01/2026",
        "expiryDate": "12/2027",
        "composition": "Pantoprazole 40 mg",
        "quantity": 10000,
        "mrp": "₹120",
        "sealId": "SEAL-APX-001",
        "aiExtracted": valid_ai_extraction,
    }

    create_res = client.post("/api/batches", headers=mfg_headers, json=valid_payload)
    assert create_res.status_code == 201, f"Batch creation failed: {create_res.get_json()}"
    create_data = create_res.get_json()
    assert create_data["success"] is True
    batch_record = create_data["batch"]

    # Verify trusted baseline and hashes
    assert "trustedBaseline" in create_data
    baseline = create_data["trustedBaseline"]
    trusted_hash = baseline["trustedDataHash"]
    fingerprint = baseline["batchFingerprint"]
    assert trusted_hash.startswith("0x"), "Hash should start with 0x"
    assert fingerprint.startswith("FP-"), "Fingerprint should start with FP-"
    print(f"  [PASS] Trusted Baseline Created:")
    print(f"         trustedDataHash: {trusted_hash}")
    print(f"         batchFingerprint: {fingerprint}")

    # Verify real blockchain transaction receipt
    assert "blockchainReceipt" in create_data
    bc_receipt = create_data["blockchainReceipt"]
    assert bc_receipt["transactionHash"] is not None
    assert bc_receipt["blockNumber"] is not None
    assert bc_receipt["contractAddress"] == blockchain_service.contract_address
    print(f"  [PASS] Blockchain Registration Confirmed:")
    print(f"         Transaction Hash: {bc_receipt['transactionHash']}")
    print(f"         Block Number: #{bc_receipt['blockNumber']}")
    print(f"         Contract Address: {bc_receipt['contractAddress']}")

    # ----------------------------------------------------
    # TEST 5: Verify Batch in MongoDB
    # ----------------------------------------------------
    print("\n[TEST 5] Verifying Batch in MongoDB Atlas...")
    saved_batch = batches_col.find_one({"batchId": "APX-PAN-24001"})
    assert saved_batch is not None, "Batch not found in MongoDB"
    assert saved_batch["status"] == "Registered"
    assert saved_batch["currentHolderName"] == "Apex Pharma Pvt. Ltd."
    assert saved_batch["stage"] == "Manufacturer"
    assert saved_batch["verificationStatus"] == "Verified"
    assert saved_batch["blockchainTx"] == bc_receipt["transactionHash"]
    print(f"  [PASS] MongoDB record confirmed:")
    print(f"         Batch ID: {saved_batch['batchId']}")
    print(f"         Holder: {saved_batch['currentHolderName']}")
    print(f"         Status: {saved_batch['status']}")
    print(f"         Stage: {saved_batch['stage']}")

    # ----------------------------------------------------
    # TEST 6: Authority Automatic Reflection
    # ----------------------------------------------------
    print("\n[TEST 6] Testing Authority Automatic Reflection...")
    # Login as Authority
    auth_login = client.post("/api/auth/login", json={
        "username": "authority_admin",
        "password": "Admin@123"
    })
    assert auth_login.status_code == 200
    auth_headers = {"Authorization": f"Bearer {auth_login.get_json()['token']}"}

    # Authority fetches summary
    summary_res = client.get("/api/batches/summary", headers=auth_headers)
    assert summary_res.status_code == 200
    metrics = summary_res.get_json()["metrics"]
    assert metrics["totalActive"] >= 1, f"Expected totalActive >= 1, got {metrics['totalActive']}"
    assert metrics["verified"] >= 1, f"Expected verified >= 1, got {metrics['verified']}"
    print(f"  [PASS] Authority Dashboard Summary updated automatically:")
    print(f"         Total Active Batches: {metrics['totalActive']}")
    print(f"         Verified: {metrics['verified']}")

    # Authority fetches batches list
    batches_res = client.get("/api/batches", headers=auth_headers)
    assert batches_res.status_code == 200
    all_batches = batches_res.get_json()["batches"]
    found_batch = next((b for b in all_batches if b["batchId"] == "APX-PAN-24001"), None)
    assert found_batch is not None, "APX-PAN-24001 not found in Authority batches list"
    assert found_batch["currentHolderName"] == "Apex Pharma Pvt. Ltd."
    assert found_batch["status"] == "Registered"
    print(f"  [PASS] Authority automatically sees the new batch:")
    print(f"         APX-PAN-24001 ({found_batch['medicineName']})")
    print(f"         Current Holder: {found_batch['currentHolderName']}")
    print(f"         Status: {found_batch['status']}")

    print("\n========================================")
    print("ALL PHASE 2 TESTS PASSED (6/6)")
    print("========================================")


if __name__ == "__main__":
    test_phase_2()
