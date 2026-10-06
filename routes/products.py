"""
Product Catalog Management Routes for Online Shopping System.
Handles inventory management, live filtering, and stock adjustments.
"""

from flask import Blueprint, request, jsonify
from db import get_db, rows_to_dict_list, translate_oracle_error

products_bp = Blueprint("products", __name__)

@products_bp.route("/products", methods=["GET"])
def get_products():
    """
    Fetches all products with Category join.
    Supports dynamic live filtering via ?search= and ?category_id=.
    """
    search = request.args.get("search", "").strip()
    category_id = request.args.get("category_id", "").strip()

    sql = """
        SELECT 
            p.product_id, 
            p.product_name, 
            p.price, 
            p.stock_qty, 
            p.category_id, 
            c.category_name
        FROM Product p
        JOIN Category c ON p.category_id = c.category_id
        WHERE 1=1
    """
    params = {}

    if category_id and category_id.isdigit():
        sql += " AND p.category_id = :cat_id"
        params["cat_id"] = int(category_id)

    if search:
        sql += " AND (LOWER(p.product_name) LIKE :search_term OR LOWER(c.category_name) LIKE :search_term)"
        params["search_term"] = f"%{search.lower()}%"

    sql += " ORDER BY p.product_id ASC"

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return jsonify(rows_to_dict_list(cursor))
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@products_bp.route("/products", methods=["POST"])
def add_product():
    """
    Creates a new product catalog item.
    Enforces check constraints (price > 0, stock_qty >= 0) via Oracle DDL.
    """
    data = request.get_json() or {}
    product_name = data.get("product_name", "").strip()
    category_id = data.get("category_id")
    price = data.get("price")
    stock_qty = data.get("stock_qty")

    if not product_name or price is None or stock_qty is None or category_id is None:
        return jsonify({"error": "product_name, category_id, price, and stock_qty are all required."}), 400

    try:
        price = float(price)
        stock_qty = int(stock_qty)
        category_id = int(category_id)
    except ValueError:
        return jsonify({"error": "Price must be a valid number and stock_qty must be an integer."}), 400

    sql = """
        INSERT INTO Product (product_name, price, stock_qty, category_id)
        VALUES (:product_name, :price, :stock_qty, :category_id)
        RETURNING product_id INTO :new_id
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            new_id = cursor.var(int)
            cursor.execute(sql, {
                "product_name": product_name,
                "price": price,
                "stock_qty": stock_qty,
                "category_id": category_id,
                "new_id": new_id
            })
            conn.commit()
            created_id = new_id.getvalue()[0]

            return jsonify({
                "message": "Product added successfully.",
                "product_id": created_id,
                "product_name": product_name,
                "price": price,
                "stock_qty": stock_qty,
                "category_id": category_id
            }), 201
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@products_bp.route("/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    """Updates product pricing, stock quantity or classification."""
    data = request.get_json() or {}
    product_name = data.get("product_name")
    category_id = data.get("category_id")
    price = data.get("price")
    stock_qty = data.get("stock_qty")

    sql = """
        UPDATE Product
        SET 
            product_name = COALESCE(:product_name, product_name),
            category_id = COALESCE(:category_id, category_id),
            price = COALESCE(:price, price),
            stock_qty = COALESCE(:stock_qty, stock_qty)
        WHERE product_id = :product_id
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, {
                "product_name": product_name,
                "category_id": category_id,
                "price": price,
                "stock_qty": stock_qty,
                "product_id": product_id
            })
            if cursor.rowcount == 0:
                return jsonify({"error": "Product not found."}), 404
            conn.commit()
            return jsonify({
                "message": f"Product #{product_id} updated successfully.",
                "product_id": product_id
            })
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@products_bp.route("/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    """
    Deletes product from catalog.
    If product is referenced by historical orders, Oracle raises ORA-02292 (child record exists).
    """
    sql = "DELETE FROM Product WHERE product_id = :product_id"
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, {"product_id": product_id})
            if cursor.rowcount == 0:
                return jsonify({"error": "Product not found."}), 404
            conn.commit()
            return jsonify({"message": f"Product #{product_id} deleted successfully."})
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]
