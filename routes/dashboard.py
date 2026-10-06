"""
Dashboard and Statistical Analytics Routes for Online Shopping System.
Handles KPI stat cards and Chart.js endpoints.
"""

from flask import Blueprint, jsonify
from db import get_db, rows_to_dict_list, translate_oracle_error, DB_TYPE

dashboard_bp = Blueprint("dashboard", __name__)

# SQLite does not support FETCH FIRST; use LIMIT there.
TOP_5_CLAUSE = "FETCH FIRST 5 ROWS ONLY" if DB_TYPE == "oracle" else "LIMIT 5"

@dashboard_bp.route("/stats", methods=["GET"])
def get_stats():
    """
    Returns aggregate stats for the 4 header cards:
    Total Customers, Total Products, Total Orders, Total Revenue, and Pending Payments count.
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Aggregate queries using SQL NVL and SUM
            cursor.execute("SELECT COUNT(*) FROM Customer")
            total_customers = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Product")
            total_products = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM Orders")
            total_orders = cursor.fetchone()[0]

            cursor.execute("SELECT COALESCE(SUM(quantity * unit_price), 0) FROM Order_Item")
            total_revenue = float(cursor.fetchone()[0] or 0)

            cursor.execute("SELECT COUNT(*) FROM Payment WHERE payment_status = 'Pending'")
            pending_payments = cursor.fetchone()[0]

            return jsonify({
                "total_customers": total_customers,
                "total_products": total_products,
                "total_orders": total_orders,
                "total_revenue": total_revenue,
                "pending_payments": pending_payments
            })
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@dashboard_bp.route("/charts/revenue-by-category", methods=["GET"])
def get_revenue_by_category():
    """
    Returns total revenue grouped by product category for Doughnut Chart.
    """
    sql = """
        SELECT c.category_name, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
        FROM Category c
        LEFT JOIN Product p ON c.category_id = p.category_id
        LEFT JOIN Order_Item oi ON p.product_id = oi.product_id
        GROUP BY c.category_id, c.category_name
        ORDER BY revenue DESC
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            results = rows_to_dict_list(cursor)
            return jsonify(results)
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@dashboard_bp.route("/charts/top-products", methods=["GET"])
def get_top_products():
    """
    Returns top 5 products ranked by total unit quantity sold for Horizontal Bar Chart.
    Uses 'FETCH FIRST 5 ROWS ONLY' on Oracle and 'LIMIT 5' on SQLite.
    """
    sql = f"""
        SELECT p.product_name, COALESCE(SUM(oi.quantity), 0) AS total_sold
        FROM Product p
        JOIN Order_Item oi ON p.product_id = oi.product_id
        GROUP BY p.product_id, p.product_name
        ORDER BY total_sold DESC
        {TOP_5_CLAUSE}
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            results = rows_to_dict_list(cursor)
            return jsonify(results)
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@dashboard_bp.route("/charts/orders-by-status", methods=["GET"])
def get_orders_by_status():
    """
    Returns distribution of orders by fulfillment status (Placed, Shipped, Delivered) for Pie Chart.
    """
    sql = """
        SELECT status, COUNT(*) AS count
        FROM Orders
        GROUP BY status
        ORDER BY count DESC
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            results = rows_to_dict_list(cursor)
            return jsonify(results)
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@dashboard_bp.route("/charts/customer-spending", methods=["GET"])
def get_customer_spending():
    """
    Returns top spending customers for Bar Chart analysis.
    """
    sql = f"""
        SELECT c.name, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_spent
        FROM Customer c
        JOIN Orders o ON c.customer_id = o.customer_id
        JOIN Order_Item oi ON o.order_id = oi.order_id
        GROUP BY c.customer_id, c.name
        ORDER BY total_spent DESC
        {TOP_5_CLAUSE}
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            results = rows_to_dict_list(cursor)
            return jsonify(results)
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]
