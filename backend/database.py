import logging
from pymongo import MongoClient, ASCENDING
from werkzeug.security import generate_password_hash
from config import Config

logger = logging.getLogger(__name__)

# Initialize PyMongo Client & Collections immediately
client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=8000)
db = client[Config.DB_NAME]

organizations_col = db["organizations"]
users_col = db["users"]
supply_chain_rules_col = db["supply_chain_rules"]
batches_col = db["batches"]
discrepancies_col = db["discrepancies"]
audit_logs_col = db["audit_logs"]


def init_db():
    try:
        logger.info("Connecting to MongoDB Atlas...")
        client.admin.command("ping")
        logger.info(f"Connected successfully to MongoDB database: '{Config.DB_NAME}'")

        # Setup indexes
        _setup_indexes()

        # Seed initial Authority administrator if none exists
        _seed_initial_data()

        return True
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        return False


def _setup_indexes():
    try:
        users_col.create_index([("email", ASCENDING)], unique=True)
        users_col.create_index([("username", ASCENDING)], unique=True)
        organizations_col.create_index([("name", ASCENDING)], unique=True)
        batches_col.create_index([("batchId", ASCENDING)], unique=True)
        batches_col.create_index([("batchNumber", ASCENDING)])
        logger.info("MongoDB indexes verified/created.")
    except Exception as e:
        logger.warning(f"Index creation note: {e}")


def _seed_initial_data():
    """Seeds the default regulatory authority user if no authority exists."""
    try:
        existing_authority = users_col.find_one({"role": "Authority"})
        if not existing_authority:
            # Create default Regulatory Authority organization
            auth_org = organizations_col.find_one({"type": "Authority"})
            if not auth_org:
                auth_org_id = organizations_col.insert_one({
                    "name": "Central Drugs Standard Control Organisation (CDSCO)",
                    "code": "CDSCO-HQ",
                    "type": "Authority",
                    "status": "Active",
                    "address": "FDA Bhawan, Kotla Road, New Delhi",
                    "contactEmail": "authority@pharmashield.gov",
                    "createdAt": "2026-01-01T00:00:00Z"
                }).inserted_id
            else:
                auth_org_id = auth_org["_id"]

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
                "createdAt": "2026-01-01T00:00:00Z"
            })
            logger.info("Seeded initial Authority user: authority@pharmashield.gov / Admin@123")
    except Exception as e:
        logger.warning(f"Seed note: {e}")


def check_db_health():
    try:
        if client is None:
            return False, "Not initialized"
        client.admin.command("ping")
        return True, "Connected"
    except Exception as e:
        return False, str(e)
