import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app import app
from database import users_col, organizations_col, supply_chain_rules_col


def test_phase_1():
    print("========================================")
    print("RUNNING PHARMASHIELD AI - PHASE 1 TESTS")
    print("========================================")

    client = app.test_client()

    # ----------------------------------------------------
    # TEST 1: Authority logs in successfully
    # ----------------------------------------------------
    print("\n[TEST 1] Authority login test...")
    login_res = client.post("/api/auth/login", json={
        "username": "authority_admin",
        "password": "Admin@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.get_json()}"
    data = login_res.get_json()
    assert data["success"] is True, "Login success flag was not True"
    assert "token" in data, "No JWT token returned"
    assert data["user"]["role"] == "Authority", f"Expected Authority role, got {data['user']['role']}"
    auth_token = data["token"]
    auth_headers = {"Authorization": f"Bearer {auth_token}"}
    print(f"  [PASS] Authority logged in successfully! Role: {data['user']['role']}")

    # ----------------------------------------------------
    # TEST 2: Authority creates Apex Pharma
    # ----------------------------------------------------
    print("\n[TEST 2] Authority creates organisation: 'Apex Pharma'...")
    apex_res = client.post("/api/organizations", headers=auth_headers, json={
        "name": "Apex Pharma Pvt. Ltd.",
        "type": "Manufacturer",
        "code": "APEX",
        "address": "MIDC Industrial Estate, Kurkumbh, Pune, MH",
        "contactPerson": "Dr. Vinod Kapur",
        "contactEmail": "regulatory@apexpharma.com",
        "contactPhone": "+91 20 2740 1000",
        "status": "Active"
    })
    # If already created, handle 409 or 201
    if apex_res.status_code == 409:
        print("  [NOTE] 'Apex Pharma Pvt. Ltd.' already exists in MongoDB Atlas.")
    else:
        assert apex_res.status_code == 201, f"Failed to create Apex Pharma: {apex_res.get_json()}"
        print(f"  [PASS] Apex Pharma created: {apex_res.get_json()['organization']['name']}")

    # Verify in DB
    apex_org = organizations_col.find_one({"name": "Apex Pharma Pvt. Ltd."})
    assert apex_org is not None, "Apex Pharma not found in MongoDB"
    apex_id = str(apex_org["_id"])
    print(f"  [PASS] Verified in MongoDB: {apex_org['name']} (Type: {apex_org['type']}, ID: {apex_id})")

    # ----------------------------------------------------
    # TEST 3: Authority creates ABC Distributors, XYZ Wholesale, HealthPlus Pharmacy
    # ----------------------------------------------------
    print("\n[TEST 3] Authority creates: ABC Distributors, XYZ Wholesale, HealthPlus Pharmacy...")
    other_orgs = [
        {
            "name": "ABC Distributors",
            "type": "Distributor",
            "code": "ABCD",
            "address": "Sector 18 Logistics Hub, Gurgaon, HR",
            "contactPerson": "Rahul Mehta",
            "contactEmail": "ops@abcdistributors.com",
            "contactPhone": "+91 124 456 7890"
        },
        {
            "name": "XYZ Wholesale",
            "type": "Wholesaler",
            "code": "XYZW",
            "address": "Pharma Trade Complex, Ahmedabad, GJ",
            "contactPerson": "Vikram Patel",
            "contactEmail": "trade@xyzwholesale.com",
            "contactPhone": "+91 79 2654 3210"
        },
        {
            "name": "HealthPlus Pharmacy",
            "type": "Retailer",
            "code": "HPLU",
            "address": "Linking Road, Bandra West, Mumbai, MH",
            "contactPerson": "Dr. Sneha Rao",
            "contactEmail": "pharmacy@healthplus.com",
            "contactPhone": "+91 22 2640 5500"
        }
    ]

    for org_data in other_orgs:
        r = client.post("/api/organizations", headers=auth_headers, json=org_data)
        if r.status_code == 409:
            print(f"  [NOTE] '{org_data['name']}' already exists.")
        else:
            assert r.status_code == 201, f"Failed to create {org_data['name']}: {r.get_json()}"
            print(f"  [PASS] Created '{org_data['name']}' ({org_data['type']})")

    # Verify all 4 orgs exist
    abc_org = organizations_col.find_one({"name": "ABC Distributors"})
    xyz_org = organizations_col.find_one({"name": "XYZ Wholesale"})
    health_org = organizations_col.find_one({"name": "HealthPlus Pharmacy"})
    assert abc_org and xyz_org and health_org, "One or more organisations missing from DB"
    abc_id = str(abc_org["_id"])
    xyz_id = str(xyz_org["_id"])
    health_id = str(health_org["_id"])
    print("  [PASS] All 4 supply-chain organisations verified in MongoDB Atlas!")

    # ----------------------------------------------------
    # TEST 4: Authority creates users for each organisation
    # ----------------------------------------------------
    print("\n[TEST 4] Authority creates operators for each organisation...")
    users_to_create = [
        {
            "fullName": "Aarav Sharma",
            "username": "aarav_apex",
            "email": "aarav@apexpharma.com",
            "password": "Password@123",
            "organizationId": apex_id,
            "role": "Manufacturer Operator"
        },
        {
            "fullName": "Rahul Mehta",
            "username": "rahul_abc",
            "email": "rahul@abcdistributors.com",
            "password": "Password@123",
            "organizationId": abc_id,
            "role": "Distributor Operator"
        },
        {
            "fullName": "Vikram Patel",
            "username": "vikram_xyz",
            "email": "vikram@xyzwholesale.com",
            "password": "Password@123",
            "organizationId": xyz_id,
            "role": "Wholesaler Operator"
        },
        {
            "fullName": "Dr. Sneha Rao",
            "username": "sneha_healthplus",
            "email": "sneha@healthplus.com",
            "password": "Password@123",
            "organizationId": health_id,
            "role": "Retailer Operator"
        }
    ]

    for u_data in users_to_create:
        ur = client.post("/api/users", headers=auth_headers, json=u_data)
        if ur.status_code == 409:
            print(f"  [NOTE] User '{u_data['username']}' already exists.")
        else:
            assert ur.status_code == 201, f"Failed to create user {u_data['username']}: {ur.get_json()}"
            print(f"  [PASS] Created operator '{u_data['fullName']}' (@{u_data['username']}) for role '{u_data['role']}'")

    # Verify users in DB
    for u_data in users_to_create:
        doc = users_col.find_one({"username": u_data["username"]})
        assert doc is not None, f"User {u_data['username']} not found in MongoDB"
        assert doc["organizationId"] == u_data["organizationId"], "User organization mismatch"
    print("  [PASS] All 4 organization users successfully created and mapped in MongoDB Atlas!")

    # ----------------------------------------------------
    # TEST 5: Authority configures supply chain route: Apex Pharma -> ABC Distributors -> XYZ Wholesale -> HealthPlus Pharmacy
    # ----------------------------------------------------
    print("\n[TEST 5] Authority configures supply chain route...")
    route_payload = {
        "name": "Standard National Distribution Route",
        "relationships": [
            {"stage": "Manufacturer", "orgId": apex_id, "orgName": "Apex Pharma Pvt. Ltd.", "orgCode": "APEX"},
            {"stage": "Distributor", "orgId": abc_id, "orgName": "ABC Distributors", "orgCode": "ABCD"},
            {"stage": "Wholesaler", "orgId": xyz_id, "orgName": "XYZ Wholesale", "orgCode": "XYZW"},
            {"stage": "Retailer", "orgId": health_id, "orgName": "HealthPlus Pharmacy", "orgCode": "HPLU"},
        ],
        "allowedTransitions": [
            {"from": "Manufacturer", "to": "Distributor", "fromOrg": "Apex Pharma Pvt. Ltd.", "toOrg": "ABC Distributors"},
            {"from": "Distributor", "to": "Wholesaler", "fromOrg": "ABC Distributors", "toOrg": "XYZ Wholesale"},
            {"from": "Wholesaler", "to": "Retailer", "fromOrg": "XYZ Wholesale", "toOrg": "HealthPlus Pharmacy"},
        ],
        "stages": [
            {"stage": "Manufacturer", "order": 1, "description": "Batch registration, packaging & initial AI verification"},
            {"stage": "Distributor", "order": 2, "description": "Bulk receiving, scan verification & onward dispatch"},
            {"stage": "Wholesaler", "order": 3, "description": "Regional transit hub receiving & verification"},
            {"stage": "Retailer", "order": 4, "description": "Final pharmacy point-of-dispense verification"},
        ]
    }
    route_res = client.post("/api/supply-chain/rules", headers=auth_headers, json=route_payload)
    assert route_res.status_code == 200, f"Failed to save route rules: {route_res.get_json()}"
    print(f"  [PASS] Route saved: Apex Pharma -> ABC Distributors -> XYZ Wholesale -> HealthPlus Pharmacy")

    # Verify route in DB
    rule_doc = supply_chain_rules_col.find_one({"isDefault": True})
    assert rule_doc is not None, "Rule doc not found in MongoDB"
    assert len(rule_doc["relationships"]) == 4, "Expected 4 relationships"
    print(f"  [PASS] Verified 4 mapped stages in MongoDB: {[r['orgName'] for r in rule_doc['relationships']]}")

    # ----------------------------------------------------
    # TEST 6: Logout and Login again, verify persistence
    # ----------------------------------------------------
    print("\n[TEST 6] Logout and re-login verification...")
    # Client drops old token, logs in again
    relogin_res = client.post("/api/auth/login", json={
        "username": "authority_admin",
        "password": "Admin@123"
    })
    assert relogin_res.status_code == 200, "Re-login failed"
    new_token = relogin_res.get_json()["token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # Fetch organizations with new token
    orgs_res = client.get("/api/organizations", headers=new_headers)
    assert orgs_res.status_code == 200
    org_list = orgs_res.get_json()["organizations"]
    org_names = [o["name"] for o in org_list]
    for required_name in ["Apex Pharma Pvt. Ltd.", "ABC Distributors", "XYZ Wholesale", "HealthPlus Pharmacy"]:
        assert required_name in org_names, f"Missing {required_name} after re-login"
    print(f"  [PASS] Re-login successful and all organizations persistent ({len(org_list)} orgs retrieved)")

    # ----------------------------------------------------
    # TEST 7: Backend restart simulation & MongoDB persistence check
    # ----------------------------------------------------
    print("\n[TEST 7] Backend restart & MongoDB data persistence...")
    # Directly query MongoDB Atlas to prove persistence independent of server memory
    direct_orgs_count = organizations_col.count_documents({})
    direct_users_count = users_col.count_documents({})
    direct_rule = supply_chain_rules_col.find_one({"isDefault": True})

    assert direct_orgs_count >= 4, f"Expected at least 4 orgs in MongoDB, found {direct_orgs_count}"
    assert direct_users_count >= 5, f"Expected at least 5 users (1 authority + 4 operators), found {direct_users_count}"
    assert direct_rule is not None, "Supply chain rule was not found in MongoDB"
    print(f"  [PASS] Direct MongoDB Atlas query verified: {direct_orgs_count} organisations, {direct_users_count} users, persistent route rules.")

    # ----------------------------------------------------
    # TEST 8: Attempt to access Authority APIs using a non-Authority user
    # ----------------------------------------------------
    print("\n[TEST 8] Access control: Non-Authority user attempting Authority endpoints...")
    # Login as Aarav Sharma (Manufacturer Operator)
    mfg_login = client.post("/api/auth/login", json={
        "username": "aarav_apex",
        "password": "Password@123"
    })
    assert mfg_login.status_code == 200, f"Manufacturer login failed: {mfg_login.get_json()}"
    mfg_token = mfg_login.get_json()["token"]
    mfg_headers = {"Authorization": f"Bearer {mfg_token}"}
    print(f"  [INFO] Logged in as non-authority user: {mfg_login.get_json()['user']['username']} (Role: {mfg_login.get_json()['user']['role']})")

    # Non-Authority attempts to create an organization (Authority only)
    forbidden_org_res = client.post("/api/organizations", headers=mfg_headers, json={
        "name": "Intruder Corp",
        "type": "Manufacturer"
    })
    assert forbidden_org_res.status_code == 403, f"Expected 403 Forbidden, got {forbidden_org_res.status_code}"
    print(f"  [PASS] POST /api/organizations rejected with 403 Forbidden: {forbidden_org_res.get_json()['error']}")

    # Non-Authority attempts to fetch users (Authority only)
    forbidden_user_res = client.get("/api/users", headers=mfg_headers)
    assert forbidden_user_res.status_code == 403, f"Expected 403 Forbidden, got {forbidden_user_res.status_code}"
    print(f"  [PASS] GET /api/users rejected with 403 Forbidden: {forbidden_user_res.get_json()['error']}")

    # Non-Authority attempts to modify supply-chain rules (Authority only)
    forbidden_rule_res = client.post("/api/supply-chain/rules", headers=mfg_headers, json={
        "name": "Malicious Route Modification"
    })
    assert forbidden_rule_res.status_code == 403, f"Expected 403 Forbidden, got {forbidden_rule_res.status_code}"
    print(f"  [PASS] POST /api/supply-chain/rules rejected with 403 Forbidden: {forbidden_rule_res.get_json()['error']}")

    print("\n========================================")
    print("ALL PHASE 1 TESTS PASSED (8/8)")
    print("========================================")


if __name__ == "__main__":
    test_phase_1()
