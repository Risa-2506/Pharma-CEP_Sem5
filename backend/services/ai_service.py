import hashlib
import json
import logging
import re
import requests
from config import Config

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.ocr_url = Config.OCR_SERVICE_URL
        self.groq_api_key = Config.GROQ_API_KEY

    def get_status(self) -> dict:
        ocr_active = False
        try:
            res = requests.get(f"{self.ocr_url}/", timeout=2)
            if res.status_code == 200:
                ocr_active = True
        except Exception:
            ocr_active = False

        return {
            "ocrServiceActive": ocr_active,
            "ocrServiceUrl": self.ocr_url,
            "groqConfigured": bool(self.groq_api_key),
            "aiEngine": "Groq Qwen Vision (qwen/qwen3.8-27b) + Tesseract OCR",
        }

    def analyze_image(self, file_bytes: bytes, filename: str) -> dict:
        """Sends image to OCR service / Groq Vision for medicine package extraction."""
        # Try OCR service first
        try:
            files = {"image": (filename, file_bytes, "image/jpeg")}
            res = requests.post(f"{self.ocr_url}/api/medicine/gemini-vision", files=files, timeout=60)
            if res.status_code == 200:
                return res.json()
        except Exception as e:
            logger.warning(f"Vision endpoint error: {e}, falling back to OCR endpoint...")

        # Fallback to local OCR endpoint
        try:
            files = {"image": (filename, file_bytes, "image/jpeg")}
            res = requests.post(f"{self.ocr_url}/api/medicine/ocr", files=files, timeout=30)
            if res.status_code == 200:
                return res.json()
        except Exception as e:
            logger.error(f"OCR endpoint error: {e}")

        # If direct Groq key is configured, call Groq directly
        if self.groq_api_key:
            return self._call_groq_direct(file_bytes)

        return {
            "success": False,
            "error": "Image extraction service unavailable. Please check that OCR service or GROQ_API_KEY is configured.",
            "medicineInfo": None,
        }

    def _call_groq_direct(self, file_bytes: bytes) -> dict:
        import base64

        mime_type = "image/jpeg"
        if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
            mime_type = "image/png"
        elif file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
            mime_type = "image/webp"

        base64_img = base64.b64encode(file_bytes).decode("utf-8")
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "qwen/qwen3.8-27b",
            "messages": [
                {
                    "role": "system",
                    "content": "Extract medicine packaging info. Return JSON with medicineName, manufacturer, composition, batchNumber, manufacturingDate, expiryDate, mrp.",
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Extract all printed package details."},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_img}"}},
                    ],
                },
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        }
        try:
            r = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=45)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            return {"success": True, "medicineInfo": parsed}
        except Exception as e:
            logger.error(f"Direct Groq call failed: {e}")
            return {"success": False, "error": str(e), "medicineInfo": None}

    @staticmethod
    def verify_manufacturer_input(input_data: dict, ai_data: dict) -> dict:
        """Compares manufacturer-entered data ONLY against AI extracted details."""
        def normalize(val):
            if val is None:
                return ""
            return re.sub(r"[\s\-_.,/]+", "", str(val).strip().lower())

        checks = {}
        passed = True
        failures = []

        fields_to_check = [
            ("medicineName", "Medicine Name"),
            ("batchNumber", "Batch Number"),
            ("expiryDate", "Expiry Date"),
        ]

        # Optional checks if provided in both
        if input_data.get("composition") and ai_data.get("composition"):
            fields_to_check.append(("composition", "Composition"))
        if input_data.get("manufacturer") and ai_data.get("manufacturer"):
            fields_to_check.append(("manufacturer", "Manufacturer"))

        for key, label in fields_to_check:
            in_val = input_data.get(key)
            ai_val = ai_data.get(key)
            norm_in = normalize(in_val)
            norm_ai = normalize(ai_val)

            match = (norm_in in norm_ai) or (norm_ai in norm_in) if (norm_in and norm_ai) else False
            checks[key] = {
                "field": label,
                "entered": in_val,
                "extracted": ai_val,
                "match": match,
            }
            if not match:
                passed = False
                failures.append(label)

        return {
            "verified": passed,
            "status": "PASSED" if passed else "FAILED",
            "fieldChecks": checks,
            "failedFields": failures,
        }

    @staticmethod
    def generate_trusted_baseline(canonical_data: dict) -> dict:
        """Creates canonical trusted baseline with cryptographic hashes."""
        sorted_keys = sorted(canonical_data.keys())
        canonical_str = "|".join(f"{k}:{canonical_data[k]}" for k in sorted_keys)
        trusted_hash = hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()
        fingerprint = hashlib.sha256(f"PS-FP:{trusted_hash}".encode("utf-8")).hexdigest()[:16].upper()

        return {
            "canonicalData": canonical_data,
            "trustedDataHash": f"0x{trusted_hash}",
            "batchFingerprint": f"FP-{fingerprint}",
        }


ai_service = AIService()
