import os
from dotenv import load_dotenv

# Load root .env
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT_DIR, ".env"))


class Config:
    PORT = int(os.getenv("PORT", 5000))
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"

    # MongoDB Atlas (default safe fallback without secrets; reads live URI from local .env)
    MONGO_URI = os.getenv(
        "MONGO_URI",
        "mongodb://localhost:27017/pharmashield",
    )
    DB_NAME = os.getenv("DB_NAME", "pharmashield")

    # JWT Authentication
    JWT_SECRET = os.getenv("JWT_SECRET", "pharmashield_secure_jwt_secret_token_2026_xyz")
    JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", 168))

    # Blockchain
    RPC_URL = os.getenv("RPC_URL", "http://127.0.0.1:8545")
    CONTRACT_ADDRESS = os.getenv(
        "CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    )
    HARDHAT_OWNER_PRIVATE_KEY = os.getenv(
        "HARDHAT_OWNER_PRIVATE_KEY",
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    )
    HARDHAT_OWNER_ADDRESS = os.getenv(
        "HARDHAT_OWNER_ADDRESS", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    )

    # Artifact paths
    ABI_PATH = os.path.join(
        ROOT_DIR,
        "pharmashield-blockchain",
        "artifacts",
        "contracts",
        "PharmaShield.sol",
        "PharmaShield.json",
    )

    # OCR / AI Service
    OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://127.0.0.1:5001")
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
