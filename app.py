"""
Online Shopping System - Flask REST API Backend.
DBMS College Project using Oracle 23ai Database.
Serves both JSON REST API endpoints (/api/*) and the frontend dashboard (/).
"""

import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

# Import route blueprints
from routes.dashboard import dashboard_bp
from routes.customers import customers_bp
from routes.categories import categories_bp
from routes.products import products_bp
from routes.orders import orders_bp
from routes.payments import payments_bp

# Initialize Flask application
app = Flask(__name__, static_folder="frontend", static_url_path="")

# Enable Cross-Origin Resource Sharing
CORS(app)

# Register API blueprints with /api prefix
app.register_blueprint(dashboard_bp, url_prefix="/api")
app.register_blueprint(customers_bp, url_prefix="/api")
app.register_blueprint(categories_bp, url_prefix="/api")
app.register_blueprint(products_bp, url_prefix="/api")
app.register_blueprint(orders_bp, url_prefix="/api")
app.register_blueprint(payments_bp, url_prefix="/api")

# Serve Frontend SPA
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    """Serves plain HTML, CSS, and JS static files from the /frontend directory."""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

# Global Error Handlers
@app.errorhandler(404)
def not_found_error(e):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def internal_server_error(e):
    return jsonify({"error": "An internal server error occurred"}), 500

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    print(f"Starting Flask REST API server on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
