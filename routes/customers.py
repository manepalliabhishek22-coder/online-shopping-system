"""
Customer Management Routes for Online Shopping System.
Handles full CRUD operations with bind variables and Oracle error mapping.
"""

from flask import Blueprint, request, jsonify
from db import get_db, rows_to_dict_list, translate_oracle_error

customers_bp = Blueprint("customers", __name__)

@customers_bp.route("/customers", methods=["GET"])
def get_customers():
    """Fetches all registered customers sorted by ID."""
    sql = "SELECT customer_id, name, email, phone, address, city FROM Customer ORDER BY customer_id ASC"
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            return jsonify(rows_to_dict_list(cursor))
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@customers_bp.route("/customers", methods=["POST"])
def add_customer():
    """
    Creates a new customer.
    Demonstrates bind variables and identity column generation.
    Catches ORA-00001 if email is already taken.
    """
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()

    if not name or not email or not city:
        return jsonify({"error": "name, email, and city are mandatory fields."}), 400

    sql = """
        INSERT INTO Customer (name, email, phone, address, city)
        VALUES (:name, :email, :phone, :address, :city)
        RETURNING customer_id INTO :new_id
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            new_id = cursor.var(int)
            cursor.execute(sql, {
                "name": name,
                "email": email,
                "phone": phone,
                "address": address,
                "city": city,
                "new_id": new_id
            })
            conn.commit()
            created_id = new_id.getvalue()[0]

            return jsonify({
                "message": "Customer created successfully.",
                "customer_id": created_id,
                "name": name,
                "email": email,
                "phone": phone,
                "address": address,
                "city": city
            }), 201
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@customers_bp.route("/customers/<int:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    """Updates customer details using bind variables."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()
    city = data.get("city", "").strip()

    if not name or not email or not city:
        return jsonify({"error": "name, email, and city are required fields."}), 400

    sql = """
        UPDATE Customer
        SET name = :name, email = :email, phone = :phone, address = :address, city = :city
        WHERE customer_id = :customer_id
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, {
                "name": name,
                "email": email,
                "phone": phone,
                "address": address,
                "city": city,
                "customer_id": customer_id
            })
            if cursor.rowcount == 0:
                return jsonify({"error": "Customer not found."}), 404
            conn.commit()
            return jsonify({
                "message": "Customer updated successfully.",
                "customer_id": customer_id,
                "name": name,
                "email": email,
                "phone": phone,
                "address": address,
                "city": city
            })
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@customers_bp.route("/customers/<int:customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    """
    Deletes customer if no active orders exist.
    Demonstrates handling of foreign key violation (ORA-02292 child record exists).
    """
    sql = "DELETE FROM Customer WHERE customer_id = :customer_id"
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, {"customer_id": customer_id})
            if cursor.rowcount == 0:
                return jsonify({"error": "Customer not found."}), 404
            conn.commit()
            return jsonify({"message": f"Customer #{customer_id} deleted successfully."})
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]
