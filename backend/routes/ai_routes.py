from flask import Blueprint, request, jsonify
from services.ai_service import ai_service
from auth.decorators import token_required

ai_bp = Blueprint("ai_bp", __name__)


@ai_bp.route("/api/ai/extract", methods=["POST"])
@token_required
def extract_medicine():
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image file provided in upload."}), 400

    image_file = request.files["image"]
    if not image_file.filename:
        return jsonify({"success": False, "error": "Empty filename."}), 400

    file_bytes = image_file.read()
    res = ai_service.analyze_image(file_bytes, image_file.filename)
    return jsonify(res), (200 if res.get("success") else 500)


@ai_bp.route("/api/ai/verify", methods=["POST"])
@token_required
def verify_medicine():
    data = request.get_json(silent=True) or {}
    manufacturer_input = data.get("manufacturerInput", {})
    ai_extracted = data.get("aiExtracted", {})

    if not manufacturer_input or not ai_extracted:
        return jsonify({
            "success": False,
            "error": "Both manufacturerInput and aiExtracted objects are required."
        }), 400

    result = ai_service.verify_manufacturer_input(manufacturer_input, ai_extracted)
    return jsonify({"success": True, "verification": result}), 200
