"""
Payment Settlement Management Routes for Online Shopping System.
Handles 1:1 payment tracking, payment status updates, and reconciliation.
"""

from flask import Blueprint, jsonify
from db import get_db, rows_to_dict_list, translate_oracle_error

payments_bp = Blueprint("payments", __name__)

@payments_bp.route("/payments", methods=["GET"])
def get_payments():
    """
    Fetches all payment transaction records joined with customer and order details.
    """
    sql = """
        SELECT 
            p.payment_id, 
            p.order_id, 
            c.name AS customer_name, 
            p.payment_method, 
            TO_CHAR(p.payment_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS payment_date, 
            p.amount, 
            p.payment_status
        FROM Payment p
        JOIN Orders o ON p.order_id = o.order_id
        JOIN Customer c ON o.customer_id = c.customer_id
        ORDER BY p.payment_id DESC
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            return jsonify(rows_to_dict_list(cursor))
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@payments_bp.route("/payments/<int:order_id>", methods=["PUT"])
def mark_payment_paid(order_id):
    """
    Settles payment for a specific order.
    Sets payment_status to 'Paid' and stamps payment_date with SYSDATE.
    """
    sql = """
        UPDATE Payment
        SET payment_status = 'Paid', payment_date = SYSDATE
        WHERE order_id = :order_id
    """
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, {"order_id": order_id})
            if cursor.rowcount == 0:
                return jsonify({"error": "Payment record for the specified order was not found."}), 404
            conn.commit()
            return jsonify({
                "message": f"Payment for Order #{order_id} marked as Paid successfully.",
                "order_id": order_id,
                "payment_status": "Paid"
            })
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]
