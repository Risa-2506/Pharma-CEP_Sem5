from functools import wraps
from flask import request, jsonify
from auth.jwt_handler import decode_access_token


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({
                "success": False,
                "error": "Authentication required. Authorization header missing."
            }), 401

        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({
                "success": False,
                "error": "Invalid Authorization header format. Expected 'Bearer <token>'."
            }), 401

        token = parts[1]
        try:
            current_user = decode_access_token(token)
            request.user = current_user
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 401
        except Exception as e:
            return jsonify({"success": False, "error": f"Authentication failed: {str(e)}"}), 401

        return f(*args, **kwargs)

    return decorated


def roles_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        @token_required
        def decorated(*args, **kwargs):
            user = getattr(request, "user", {})
            user_role = user.get("role", "")
            if user_role not in allowed_roles:
                return jsonify({
                    "success": False,
                    "error": f"Access denied. Required role in {allowed_roles}, but user is '{user_role}'."
                }), 403
            return f(*args, **kwargs)

        return decorated

    return decorator


def authority_required(f):
    return roles_required("Authority", "System Authority", "Regulatory Authority")(f)


def manufacturer_required(f):
    return roles_required("Manufacturer", "Manufacturer Operator", "Manufacturer Admin")(f)
