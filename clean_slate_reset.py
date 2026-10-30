import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from database import (
    batches_col,
    organizations_col,
    users_col,
    supply_chain_rules_col,
    discrepancies_col,
)
from werkzeug.security import generate_password_hash

def reset_to_clean_slate():
    print("=" * 60)
    print("RESETTING PHARMASHIELD AI TO CLEAN SLATE")
    print("=" * 60)

    # 1. Clear all operational batches
    deleted_batches = batches_col.delete_many({})
    print(f"[-] Cleared Batches: {deleted_batches.deleted_count} deleted.")

    # 2. Clear all discrepancies
    deleted_disc = discrepancies_col.delete_many({})
    print(f"[-] Cleared Discrepancies: {deleted_disc.deleted_count} deleted.")

    # 3. Clear all supply chain rules
    deleted_rules = supply_chain_rules_col.delete_many({})
    print(f"[-] Cleared Supply Chain Rules: {deleted_rules.deleted_count} deleted.")

    # 4. Clear all supply chain organizations (Manufacturer, Distributor, Wholesaler, Retailer)
    deleted_orgs = organizations_col.delete_many({"type": {"$ne": "Authority"}})
    print(f"[-] Cleared Non-Authority Organisations: {deleted_orgs.deleted_count} deleted.")

    # 5. Clear all supply chain users
    deleted_users = users_col.delete_many({"role": {"$ne": "Authority"}})
    print(f"[-] Cleared Non-Authority Users: {deleted_users.deleted_count} deleted.")

    # 6. Ensure Root Authority Organisation exists
    auth_org = organizations_col.find_one({"type": "Authority"})
    if not auth_org:
        auth_org_id = organizations_col.insert_one({
            "name": "Central Drugs Standard Control Organisation (CDSCO)",
            "code": "CDSCO-HQ",
            "type": "Authority",
            "status": "Active",
            "address": "FDA Bhawan, Kotla Road, New Delhi",
            "contactEmail": "authority@pharmashield.gov",
            "createdAt": "2026-01-01T00:00:00Z",
        }).inserted_id
    else:
        auth_org_id = auth_org["_id"]

    # 7. Ensure Root Authority User exists with fresh password Admin@123
    users_col.delete_many({"role": "Authority"})
    users_col.insert_one({
        "username": "authority_admin",
        "email": "authority@pharmashield.gov",
        "fullName": "National Drug Controller",
        "passwordHash": generate_password_hash("Admin@123"),
        "role": "Authority",
        "organizationId": str(auth_org_id),
        "organizationName": "Central Drugs Standard Control Organisation (CDSCO)",
        "organizationType": "Authority",
        "status": "Active",
        "createdAt": "2026-01-01T00:00:00Z",
    })
    print("[+] Verified Root Authority User: 'authority_admin' (Admin@123)")

    # 8. Report final counts
    print("-" * 60)
    print("FINAL DATABASE STATUS:")
    print(f"  • Total Batches:         {batches_col.count_documents({})}")
    print(f"  • In Transit Batches:    {batches_col.count_documents({'status': 'In Transit'})}")
    print(f"  • Verified Batches:      {batches_col.count_documents({'verificationStatus': 'Verified'})}")
    print(f"  • Discrepancies:         {discrepancies_col.count_documents({})}")
    print(f"  • Blocked Batches:       {batches_col.count_documents({'status': 'Blocked'})}")
    print(f"  • Total Organisations:   {organizations_col.count_documents({})}")
    print(f"  • Total Users:           {users_col.count_documents({})}")
    print("=" * 60)
    print("CLEAN SLATE READY! All fake test batches, users, and organizations removed.")

if __name__ == "__main__":
    reset_to_clean_slate()

