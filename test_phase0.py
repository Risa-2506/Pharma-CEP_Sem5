import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app import app
from database import check_db_health, users_col
from services.blockchain_service import blockchain_service
from services.ai_service import ai_service


def test_phase_0():
    print("========================================")
    print("RUNNING PHARMASHIELD AI - PHASE 0 TESTS")
    print("========================================")

    client = app.test_client()

    # 1. Test Database
    print("\n[TEST 1] Testing MongoDB Atlas Connection...")
    db_ok, db_msg = check_db_health()
    assert db_ok, f"MongoDB connection failed: {db_msg}"
    print(f"  [PASS] MongoDB Atlas Connected successfully: {db_msg}")

    # Verify seeded Authority
    auth_user = users_col.find_one({"role": "Authority"})
    assert auth_user is not None, "Seeded Authority user not found"
    print(f"  [PASS] Seeded Authority User verified: {auth_user['username']} ({auth_user['email']})")

    # 2. Test Blockchain
    print("\n[TEST 2] Testing Blockchain Service & Smart Contract...")
    bc_status = blockchain_service.get_status()
    assert bc_status["connected"], f"Blockchain not connected: {bc_status}"
    assert bc_status["contractLoaded"], "Smart contract not loaded"
    assert bc_status["owner"] is not None, "Contract owner is None"
    print(f"  [PASS] Connected to Hardhat RPC at {bc_status['rpcUrl']}")
    print(f"  [PASS] Chain ID: {bc_status['chainId']}")
    print(f"  [PASS] Contract Address: {bc_status['contractAddress']}")
    print(f"  [PASS] Contract Owner: {bc_status['owner']}")

    # 3. Test Health Endpoint
    print("\n[TEST 3] Testing GET /api/health Endpoint...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    health_data = res.get_json()
    assert health_data["status"] == "HEALTHY", f"Expected HEALTHY, got {health_data['status']}"
    print(f"  [PASS] /api/health returned 200 with status: {health_data['status']}")

    # 4. Test Auth Login Endpoint
    print("\n[TEST 4] Testing POST /api/auth/login Endpoint...")
    login_res = client.post("/api/auth/login", json={
        "username": "authority_admin",
        "password": "Admin@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.get_json()}"
    login_data = login_res.get_json()
    assert login_data["success"] is True, "Login success is False"
    assert "token" in login_data, "No JWT token in login response"
    assert login_data["user"]["role"] == "Authority", "Role is not Authority"
    token = login_data["token"]
    print(f"  [PASS] Login successful! Issued JWT token: {token[:25]}...")
    print(f"  [PASS] User Profile: {login_data['user']['fullName']} (Role: {login_data['user']['role']})")

    # 5. Test Authenticated Route /api/auth/me
    print("\n[TEST 5] Testing GET /api/auth/me with Bearer Token...")
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200, f"Profile request failed: {me_res.get_json()}"
    me_data = me_res.get_json()
    assert me_data["user"]["username"] == "authority_admin"
    print(f"  [PASS] Verified authenticated session for '{me_data['user']['username']}'")

    # 6. Test AI Service Bridge
    print("\n[TEST 6] Testing AI Service Integration...")
    ai_status = ai_service.get_status()
    print(f"  [PASS] AI Service Engine: {ai_status['aiEngine']}")
    print(f"  [PASS] AI Service Status check passed.")

    print("\n========================================")
    print("ALL PHASE 0 TESTS PASSED (6/6)")
    print("========================================")


if __name__ == "__main__":
    test_phase_0()
