from flask import Blueprint, jsonify
from database import check_db_health, db
from services.blockchain_service import blockchain_service
from services.ai_service import ai_service

health_bp = Blueprint("health_bp", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health():
    db_ok, db_msg = check_db_health()
    bc_status = blockchain_service.get_status()
    ai_status = ai_service.get_status()

    overall_ok = db_ok and bc_status.get("connected", False)

    return jsonify({
        "success": True,
        "status": "HEALTHY" if overall_ok else "DEGRADED",
        "service": "PharmaShield AI Platform API",
        "version": "1.0.0",
        "database": {
            "connected": db_ok,
            "message": db_msg,
            "name": db.name if db is not None else None,
        },
        "blockchain": bc_status,
        "aiService": ai_status,
    }), (200 if overall_ok else 200)
