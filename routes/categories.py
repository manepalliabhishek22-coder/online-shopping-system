"""
Category Management Routes for Online Shopping System.
Handles listing and registering product categories.
"""

from flask import Blueprint, request, jsonify
from db import get_db, rows_to_dict_list, translate_oracle_error

categories_bp = Blueprint("categories", __name__)

@categories_bp.route("/categories", methods=["GET"])
def get_categories():
    """Fetches all product categories sorted by ID."""
    sql = "SELECT category_id, category_name, description FROM Category ORDER BY category_id ASC"
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            return jsonify(rows_to_dict_list(cursor))
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@categories_bp.route("/categories", methods=["POST"])
def add_category():
    """Creates a new category using bind variables."""
    data = request.get_json() or {}
    category_name = data.get("category_name", "").strip()
    description = data.get("description", "").strip()

    if not category_name:
        return jsonify({"error": "category_name is required."}), 400

    sql = """
        INSERT INTO Category (category_name, description)
        VALUES (:category_name, :description)
        RETURNING category_id INTO :new_id
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            new_id = cursor.var(int)
            cursor.execute(sql, {
                "category_name": category_name,
                "description": description,
                "new_id": new_id
            })
            conn.commit()
            created_id = new_id.getvalue()[0]

            return jsonify({
                "message": "Category created successfully.",
                "category_id": created_id,
                "category_name": category_name,
                "description": description
            }), 201
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]
