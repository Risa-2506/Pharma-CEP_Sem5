import logging
import sys
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import init_db
from routes import (
    health_bp,
    auth_bp,
    org_bp,
    user_bp,
    supply_chain_bp,
    batch_bp,
    ai_bp,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("pharmashield-backend")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Enable CORS for all routes and origins
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Initialize MongoDB connection
    with app.app_context():
        db_connected = init_db()
        if not db_connected:
            logger.warning("MongoDB connection could not be established immediately. Will retry on request.")

    # Register Blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(org_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(supply_chain_bp)
    app.register_blueprint(batch_bp)
    app.register_blueprint(ai_bp)

    @app.route("/", methods=["GET"])
    def root():
        return jsonify({
            "platform": "PharmaShield AI Unified Platform Backend",
            "description": "Next-Gen AI & Blockchain Pharmaceutical Supply Chain Integrity System",
            "version": "1.0.0",
            "endpoints": {
                "health": "/api/health",
                "auth": "/api/auth/login",
                "organizations": "/api/organizations",
                "users": "/api/users",
                "supplyChain": "/api/supply-chain/rules",
                "batches": "/api/batches",
            },
        }), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        logger.error(f"Internal server error: {e}")
        return jsonify({"success": False, "error": "Internal server error occurred"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    logger.info(f"Starting PharmaShield Flask backend on http://127.0.0.1:{Config.PORT}...")
    app.run(host="0.0.0.0", port=Config.PORT, debug=False, use_reloader=False)
