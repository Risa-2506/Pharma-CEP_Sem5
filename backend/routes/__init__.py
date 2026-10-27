from routes.health_routes import health_bp
from routes.auth_routes import auth_bp
from routes.organization_routes import org_bp
from routes.user_routes import user_bp
from routes.supply_chain_routes import supply_chain_bp
from routes.batch_routes import batch_bp
from routes.ai_routes import ai_bp

__all__ = [
    "health_bp",
    "auth_bp",
    "org_bp",
    "user_bp",
    "supply_chain_bp",
    "batch_bp",
    "ai_bp",
]
