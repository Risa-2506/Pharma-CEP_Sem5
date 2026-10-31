import os
import sys
import time
from datetime import datetime, timezone
import requests

sys.path.insert(0, os.path.abspath("backend"))
BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    print("=================================================================")
    print("PHARMASHIELD AI - COMPLETE WHOLESALER & RETAILER TEST SUITE")
    print("=================================================================")

    # 1. Health check
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=5)
        assert r.status_code == 200, f"Health check failed: {r.status_code}"
        health = r.json()
        print(f"[+] API Health OK: Database={health['database']['connected']}, Blockchain={health['blockchain']['connected']}")
    except Exception as e:
        print(f"[-] Backend API is not reachable at {BASE_URL}: {e}")
        return False

    # 2. Authority Login
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "authority_admin", "password": "Admin@123"})
    assert r.status_code == 200, f"Authority login failed: {r.text}"
    auth_token = r.json()["token"]
    auth_headers = {"Authorization": f"Bearer {auth_token}"}
    print("[+] Test 1: Authority Login successful.")

    created_org_ids = []
    created_user_ids = []
    ts = int(time.time())
    test_batch_id = f"TEST-SUPPLY-{ts}"

    try:
        # Create full test pipeline organizations: Manufacturer, Distributor, Wholesaler, Retailer
        # Org 1: Manufacturer
        r = requests.post(f"{BASE_URL}/api/organizations", headers=auth_headers, json={
            "name": f"Test Mfg Suite {ts}",
            "type": "Manufacturer",
            "code": "TSM",
            "address": "Baddi Industrial Estate, HP",
            "contactEmail": f"mfg_{ts}@test.com"
        })
        assert r.status_code == 201, f"Create mfg org failed: {r.text}"
        mfg_org_id = str(r.json().get("organization", {}).get("id"))
        created_org_ids.append(mfg_org_id)

        # Org 2: Distributor
        r = requests.post(f"{BASE_URL}/api/organizations", headers=auth_headers, json={
            "name": f"Test Dist Suite {ts}",
            "type": "Distributor",
            "code": "TSD",
            "address": "Sector 18 Hub, Gurgaon",
            "contactEmail": f"dist_{ts}@test.com"
        })
        assert r.status_code == 201, f"Create dist org failed: {r.text}"
        dist_org_id = str(r.json().get("organization", {}).get("id"))
        created_org_ids.append(dist_org_id)

        # Org 3: Wholesaler
        r = requests.post(f"{BASE_URL}/api/organizations", headers=auth_headers, json={
            "name": f"Test Wholesaler Suite {ts}",
            "type": "Wholesaler",
            "code": "TSW",
            "address": "Regional Depot, Delhi",
            "contactEmail": f"whole_{ts}@test.com"
        })
        assert r.status_code == 201, f"Create whole org failed: {r.text}"
        whole_org_id = str(r.json().get("organization", {}).get("id"))
        created_org_ids.append(whole_org_id)

        # Org 4: Retailer / Pharmacy
        r = requests.post(f"{BASE_URL}/api/organizations", headers=auth_headers, json={
            "name": f"Test Pharmacy Suite {ts}",
            "type": "Retailer",
            "code": "TSR",
            "address": "Main Market Pharmacy, South Ext",
            "contactEmail": f"ret_{ts}@test.com"
        })
        assert r.status_code == 201, f"Create ret org failed: {r.text}"
        ret_org_id = str(r.json().get("organization", {}).get("id"))
        created_org_ids.append(ret_org_id)
        print("[+] Test 2: Created full supply-chain test organizations (Mfg -> Dist -> Wholesaler -> Retailer).")

        # Create Operators for each stage
        # 1. Mfg Operator
        r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "username": f"mfg_op_{ts}",
            "password": "Password@123",
            "fullName": "Test Mfg Operator",
            "email": f"mfg_op_{ts}@test.com",
            "role": "Manufacturer Operator",
            "organizationId": mfg_org_id,
        })
        assert r.status_code == 201, f"Create mfg user failed: {r.text}"
        mfg_user_id = str(r.json().get("user", {}).get("id"))
        created_user_ids.append(mfg_user_id)

        # 2. Dist Operator
        r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "username": f"dist_op_{ts}",
            "password": "Password@123",
            "fullName": "Test Dist Operator",
            "email": f"dist_op_{ts}@test.com",
            "role": "Distributor Operator",
            "organizationId": dist_org_id,
        })
        assert r.status_code == 201, f"Create dist user failed: {r.text}"
        dist_user_id = str(r.json().get("user", {}).get("id"))
        created_user_ids.append(dist_user_id)

        # 3. Wholesaler Operator
        r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "username": f"whole_op_{ts}",
            "password": "Password@123",
            "fullName": "Test Wholesaler Operator",
            "email": f"whole_op_{ts}@test.com",
            "role": "Wholesaler Operator",
            "organizationId": whole_org_id,
        })
        assert r.status_code == 201, f"Create whole user failed: {r.text}"
        whole_user_id = str(r.json().get("user", {}).get("id"))
        created_user_ids.append(whole_user_id)

        # 4. Retailer Operator
        r = requests.post(f"{BASE_URL}/api/users", headers=auth_headers, json={
            "username": f"ret_op_{ts}",
            "password": "Password@123",
            "fullName": "Test Retail Pharmacist",
            "email": f"ret_op_{ts}@test.com",
            "role": "Retailer Operator",
            "organizationId": ret_org_id,
        })
        assert r.status_code == 201, f"Create ret user failed: {r.text}"
        ret_user_id = str(r.json().get("user", {}).get("id"))
        created_user_ids.append(ret_user_id)
        print("[+] Test 3: Created operators for all 4 supply-chain stages.")

        # Log in as each operator to get their tokens
        mfg_res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": f"mfg_op_{ts}", "password": "Password@123"}).json()
        assert "token" in mfg_res, f"Mfg login failed: {mfg_res}"
        mfg_headers = {"Authorization": f"Bearer {mfg_res['token']}"}

        dist_res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": f"dist_op_{ts}", "password": "Password@123"}).json()
        assert "token" in dist_res, f"Dist login failed: {dist_res}"
        dist_headers = {"Authorization": f"Bearer {dist_res['token']}"}

        whole_res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": f"whole_op_{ts}", "password": "Password@123"}).json()
        assert "token" in whole_res, f"Whole login failed: {whole_res}"
        whole_headers = {"Authorization": f"Bearer {whole_res['token']}"}

        ret_res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": f"ret_op_{ts}", "password": "Password@123"}).json()
        assert "token" in ret_res, f"Ret login failed: {ret_res}"
        ret_headers = {"Authorization": f"Bearer {ret_res['token']}"}
        print("[+] Test 4: Successfully authenticated all 4 participant sessions.")

        # -----------------------------------------------------------------
        # STAGE 1: Manufacturer Registers Batch & Dispatches to Distributor
        # -----------------------------------------------------------------
        reg_payload = {
            "medicineName": "Amoxicillin 500mg Capsules",
            "batchNumber": test_batch_id,
            "manufacturingDate": "04/2026",
            "expiryDate": "04/2028",
            "composition": "Amoxicillin 500mg",
            "quantity": 1000,
            "mrp": "120",
            "sealId": f"SEAL-INIT-{ts}",
            "aiExtracted": {
                "medicineName": "Amoxicillin 500mg Capsules",
                "batchNumber": test_batch_id,
                "expiryDate": "04/2028",
                "composition": "Each capsule contains Amoxicillin Trihydrate IP Eq to Amoxicillin 500mg",
                "manufacturer": f"Test Mfg Suite {ts}",
                "mrp": "Rs. 120.00"
            }
        }
        r = requests.post(f"{BASE_URL}/api/batches", headers=mfg_headers, json=reg_payload)
        assert r.status_code == 201, f"Registration failed: {r.text}"
        batch_doc = r.json()["batch"]
        trusted_hash = batch_doc["trustedDataHash"]
        print(f"[+] Test 5: Manufacturer registered batch {test_batch_id} (Trusted Hash: {trusted_hash[:16]}...).")

        # Manufacturer transfers to Distributor
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/transfer", headers=mfg_headers, json={
            "receiverOrgId": dist_org_id,
            "newSealId": f"SEAL-TR-D-{ts}"
        })
        assert r.status_code == 200, f"Mfg -> Dist transfer failed: {r.text}"
        print("[+] Test 6: Manufacturer dispatched batch to Distributor.")

        # -----------------------------------------------------------------
        # STAGE 2: Distributor Scans, Receives, and Transfers to Wholesaler
        # -----------------------------------------------------------------
        scan_payload = {
            "aiExtracted": {
                "medicineName": "Amoxicillin 500mg Capsules",
                "batchNumber": test_batch_id,
                "expiryDate": "04/2028",
                "composition": "Each capsule contains Amoxicillin Trihydrate IP Eq to Amoxicillin 500mg",
                "manufacturer": f"Test Mfg Suite {ts}",
                "mrp": "Rs. 120.00"
            }
        }
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/verify-scan", headers=dist_headers, json=scan_payload)
        assert r.status_code == 200, f"Distributor scan verification failed: {r.text}"
        verify_data = r.json()["verification"]
        assert verify_data["verified"] is True, f"Distributor verification not True: {verify_data}"
        assert verify_data["hashMatch"] is True, "Distributor hashMatch was not True"

        # Distributor accepts custody
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/receive", headers=dist_headers, json={
            "verification": verify_data,
            "newSealId": f"SEAL-DIST-RECV-{ts}"
        })
        assert r.status_code == 200, f"Distributor receive failed: {r.text}"
        print("[+] Test 7: Distributor verified package & accepted custody.")

        # Distributor transfers to Wholesaler
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/transfer", headers=dist_headers, json={
            "receiverOrgId": whole_org_id,
            "newSealId": f"SEAL-TR-W-{ts}"
        })
        assert r.status_code == 200, f"Dist -> Wholesaler transfer failed: {r.text}"
        print("[+] Test 8: Distributor dispatched batch to Wholesaler.")

        # -----------------------------------------------------------------
        # STAGE 3: Wholesaler Scans & Receives against ORIGINAL Baseline
        # -----------------------------------------------------------------
        r = requests.get(f"{BASE_URL}/api/deliveries/incoming", headers=whole_headers)
        assert r.status_code == 200, f"Wholesaler incoming failed: {r.text}"
        incoming = r.json().get("incomingDeliveries", [])
        assert any(b["batchId"] == test_batch_id for b in incoming), "Test batch not in Wholesaler incoming deliveries"
        print("[+] Test 9: Wholesaler sees incoming delivery in transit.")

        # Wholesaler scans package
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/verify-scan", headers=whole_headers, json=scan_payload)
        assert r.status_code == 200, f"Wholesaler scan verify failed: {r.text}"
        whole_verify = r.json()["verification"]
        assert whole_verify["verified"] is True, f"Wholesaler verify not True: {whole_verify}"
        assert whole_verify["hashMatch"] is True, "Wholesaler hashMatch not True"
        assert whole_verify["trustedDataHash"] == trusted_hash, "Trusted hash mismatch at Wholesaler!"
        print(f"[+] Test 10: Wholesaler AI verified package directly against original Manufacturer baseline (Hash match: {whole_verify['hashMatch']}).")

        # Wholesaler accepts custody
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/receive", headers=whole_headers, json={
            "verification": whole_verify,
            "newSealId": f"SEAL-WHOLE-RECV-{ts}"
        })
        assert r.status_code == 200, f"Wholesaler receive failed: {r.text}"
        updated_batch = r.json()["batch"]
        assert updated_batch["status"] in ("Verified", "In Custody"), f"Expected Verified/In Custody, got {updated_batch['status']}"
        assert updated_batch["stage"] == "Wholesaler", f"Expected Wholesaler, got {updated_batch['stage']}"
        print("[+] Test 11: Wholesaler accepted custody & recorded on-chain inspection event.")

        # Wholesaler tries unauthorized transfer (e.g. transfer back to Manufacturer) - Negative test
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/transfer", headers=whole_headers, json={
            "receiverOrgId": mfg_org_id,
            "newSealId": f"SEAL-INVALID-{ts}"
        })
        assert r.status_code == 403, f"Expected 403 for unauthorized transfer, got {r.status_code}"
        print("[+] Test 12: Correctly prevented unauthorized backward transfer from Wholesaler to Manufacturer.")

        # Wholesaler transfers to authorized Retailer / Pharmacy
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/transfer", headers=whole_headers, json={
            "receiverOrgId": ret_org_id,
            "newSealId": f"SEAL-TR-R-{ts}"
        })
        assert r.status_code == 200, f"Wholesaler -> Retailer transfer failed: {r.text}"
        print("[+] Test 13: Wholesaler dispatched batch to Retailer / Pharmacy.")

        # -----------------------------------------------------------------
        # STAGE 4: Retailer Scans & Receives against ORIGINAL Baseline
        # -----------------------------------------------------------------
        r = requests.get(f"{BASE_URL}/api/deliveries/incoming", headers=ret_headers)
        assert r.status_code == 200, f"Retailer incoming failed: {r.text}"
        ret_incoming = r.json().get("incomingDeliveries", [])
        assert any(b["batchId"] == test_batch_id for b in ret_incoming), "Test batch not in Retailer incoming deliveries"
        print("[+] Test 14: Pharmacy / Retailer sees incoming delivery in transit.")

        # Retailer scans package
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/verify-scan", headers=ret_headers, json=scan_payload)
        assert r.status_code == 200, f"Retailer scan verify failed: {r.text}"
        ret_verify = r.json()["verification"]
        assert ret_verify["verified"] is True, f"Retailer verify not True: {ret_verify}"
        assert ret_verify["hashMatch"] is True, "Retailer hashMatch not True"
        assert ret_verify["trustedDataHash"] == trusted_hash, "Trusted hash mismatch at Retailer!"
        print(f"[+] Test 15: Retailer AI verified package directly against original Manufacturer baseline (Hash match: {ret_verify['hashMatch']}).")

        # Retailer accepts custody
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/receive", headers=ret_headers, json={
            "verification": ret_verify,
            "newSealId": f"SEAL-PHARM-STOCK-{ts}"
        })
        assert r.status_code == 200, f"Retailer receive failed: {r.text}"
        ret_batch = r.json()["batch"]
        assert ret_batch["status"] in ("Verified", "In Custody"), f"Expected Verified/In Custody, got {ret_batch['status']}"
        assert ret_batch["stage"] == "Retailer", f"Expected Retailer, got {ret_batch['stage']}"
        print("[+] Test 16: Pharmacy accepted custody into verified stock.")

        # -----------------------------------------------------------------
        # STAGE 4 (FINAL): Retailer Dispenses Medicine to Patient
        # -----------------------------------------------------------------
        r = requests.post(f"{BASE_URL}/api/batches/{test_batch_id}/dispense", headers=ret_headers, json={
            "patientId": f"PAT-RX-{ts}",
            "dispensedQuantity": 100,
            "notes": "Verified against prescription. Packaging intact and cryptographically authenticated."
        })
        assert r.status_code == 200, f"Dispense failed: {r.text}"
        dispense_res = r.json()
        assert dispense_res["success"] is True
        assert dispense_res["batch"]["quantity"] == 900
        print(f"[+] Test 17: Successfully dispensed 100 units to patient with on-chain inspection event.")

        # -----------------------------------------------------------------
        # AUDIT: Verify Complete On-Chain Ledger & History in Authority Portal
        # -----------------------------------------------------------------
        r = requests.get(f"{BASE_URL}/api/batches/{test_batch_id}/blockchain", headers=auth_headers)
        assert r.status_code == 200, f"Blockchain audit failed: {r.text}"
        audit = r.json()["blockchain"]
        event_names = [e["event"] for e in audit.get("events", [])]
        print(f"[+] Test 18: On-Chain Ledger Audit Verified ({len(event_names)} events recorded: {', '.join(event_names)}).")
        assert "BatchRegistered" in event_names, "Missing BatchRegistered"
        assert "BatchTransferred" in event_names, "Missing BatchTransferred"
        assert "BatchInspected" in event_names, "Missing BatchInspected"

        print("\n=================================================================")
        print(">>> ALL 18 WHOLESALER & RETAILER TESTS PASSED FLAWLESSLY! <<<")
        print("=================================================================")
        return True

    finally:
        # Clean up temporary test objects only
        print("\n[+] Cleaning up test entities...")
        try:
            from database import batches_col, organizations_col, users_col, discrepancies_col
            from bson import ObjectId
            batches_col.delete_many({"batchId": test_batch_id})
            for uid in created_user_ids:
                try:
                    users_col.delete_one({"_id": ObjectId(uid)})
                except Exception:
                    pass
            for oid in created_org_ids:
                try:
                    organizations_col.delete_one({"_id": ObjectId(oid)})
                except Exception:
                    pass
            discrepancies_col.delete_many({"batchId": test_batch_id})
            print("[+] Test entities cleaned up. Authentic database records preserved.")
        except Exception as e:
            print(f"[-] Cleanup warning: {e}")

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
