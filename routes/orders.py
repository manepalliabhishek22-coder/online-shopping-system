"""
Order Processing and Transaction Management Routes for Online Shopping System.
Implements ACID Transactions, pessimistic locking, stock management, and view queries.
"""

from flask import Blueprint, request, jsonify
from db import get_db, rows_to_dict_list, translate_oracle_error

orders_bp = Blueprint("orders", __name__)

@orders_bp.route("/orders", methods=["GET"])
def get_orders():
    """
    Fetches orders using the Oracle 23ai 'order_summary' VIEW.
    Supports optional status filtering via ?status=.
    Demonstrates the utility of SQL Views for simplifying complex multi-table joins.
    """
    status = request.args.get("status", "").strip()

    sql = "SELECT order_id, customer, order_date, status, order_total, payment_status FROM order_summary"
    params = {}

    if status:
        sql += " WHERE LOWER(status) = :status"
        params["status"] = status.lower()

    sql += " ORDER BY order_id DESC"

    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return jsonify(rows_to_dict_list(cursor))
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@orders_bp.route("/orders/<int:order_id>", methods=["GET"])
def get_order_details(order_id):
    """
    Returns full order details:
    1. Header (Customer name, email, order date, status)
    2. Line items with unit price snapshot and product name
    3. 1:1 Payment record
    """
    order_sql = """
        SELECT 
            o.order_id, 
            o.customer_id, 
            c.name AS customer_name, 
            c.email AS customer_email,
            TO_CHAR(o.order_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS order_date, 
            o.status
        FROM Orders o
        JOIN Customer c ON o.customer_id = c.customer_id
        WHERE o.order_id = :order_id
    """
    items_sql = """
        SELECT 
            oi.product_id, 
            p.product_name, 
            oi.quantity, 
            oi.unit_price, 
            (oi.quantity * oi.unit_price) AS line_total
        FROM Order_Item oi
        JOIN Product p ON oi.product_id = p.product_id
        WHERE oi.order_id = :order_id
        ORDER BY oi.product_id ASC
    """
    payment_sql = """
        SELECT 
            payment_id, 
            order_id, 
            payment_method, 
            TO_CHAR(payment_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS payment_date, 
            amount, 
            payment_status
        FROM Payment
        WHERE order_id = :order_id
    """

    try:
        with get_db() as conn:
            cursor = conn.cursor()

            # 1. Fetch Order Header
            cursor.execute(order_sql, {"order_id": order_id})
            header_rows = rows_to_dict_list(cursor)
            if not header_rows:
                return jsonify({"error": "Order not found."}), 404
            order_header = header_rows[0]

            # 2. Fetch Line Items
            cursor.execute(items_sql, {"order_id": order_id})
            items = rows_to_dict_list(cursor)

            # 3. Fetch Payment Details
            cursor.execute(payment_sql, {"order_id": order_id})
            payment_rows = rows_to_dict_list(cursor)
            payment = payment_rows[0] if payment_rows else None

            order_total = sum(float(item["line_total"]) for item in items)
            order_header["order_total"] = order_total

            return jsonify({
                "order": order_header,
                "items": items,
                "payment": payment
            })
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@orders_bp.route("/orders/<int:order_id>/status", methods=["PUT"])
def update_order_status(order_id):
    """Updates order fulfillment status (Placed -> Shipped -> Delivered)."""
    data = request.get_json() or {}
    status = data.get("status")

    allowed_statuses = ["Placed", "Shipped", "Delivered", "Cancelled"]
    if not status or status not in allowed_statuses:
        return jsonify({"error": f"Invalid status. Must be one of: {', '.join(allowed_statuses)}"}), 400

    sql = "UPDATE Orders SET status = :status WHERE order_id = :order_id"
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, {"status": status, "order_id": order_id})
            if cursor.rowcount == 0:
                return jsonify({"error": "Order not found."}), 404
            conn.commit()
            return jsonify({
                "message": f"Order #{order_id} status updated to {status}.",
                "order_id": order_id,
                "status": status
            })
    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]

@orders_bp.route("/orders", methods=["POST"])
def place_order():
    """
    ACID TRANSACTION DEMONSTRATION FOR DBMS PROJECT VIVA:
    ======================================================
    - Atomicity: All modifications (Orders, Order_Item, Product stock, Payment)
                 succeed together or fail completely with a ROLLBACK.
    - Consistency: Enforces stock_qty >= 0 (checks stock before decrement),
                   foreign key constraints, and positive pricing.
    - Isolation: Row-level locking (FOR UPDATE) prevents race conditions
                 and overselling during concurrent user checkouts.
    - Durability: Explicit COMMIT ensures all committed order records are persisted.

    Payload:
    {
        "customer_id": 1,
        "payment_method": "UPI" | "Credit Card" | "COD",
        "items": [
            {"product_id": 1, "quantity": 2},
            {"product_id": 3, "quantity": 1}
        ]
    }
    """
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    payment_method = data.get("payment_method")
    items = data.get("items", [])

    # Initial Validation
    if not customer_id or not payment_method or not items or not isinstance(items, list):
        return jsonify({"error": "customer_id, payment_method, and a non-empty items array are required."}), 400

    if payment_method not in ["UPI", "Credit Card", "COD"]:
        return jsonify({"error": "payment_method must be 'UPI', 'Credit Card', or 'COD'."}), 400

    try:
        with get_db() as conn:
            # Set autocommit to False for explicit transaction boundary
            conn.autocommit = False
            cursor = conn.cursor()

            try:
                # 1. Validate Customer Exists
                cursor.execute("SELECT customer_id FROM Customer WHERE customer_id = :cid", {"cid": customer_id})
                if not cursor.fetchone():
                    conn.rollback()
                    return jsonify({"error": "ORA-02291: Customer does not exist."}), 400

                # 2. Verify Stock and Lock Products with 'FOR UPDATE' (Pessimistic Concurrency Control)
                order_total = 0.0
                verified_items = []

                for item in items:
                    pid = item.get("product_id")
                    qty = item.get("quantity")

                    if not pid or not qty or int(qty) <= 0:
                        conn.rollback()
                        return jsonify({"error": "Every line item must have a valid product_id and positive quantity."}), 400

                    qty = int(qty)

                    # Lock the specific product row for update
                    cursor.execute(
                        "SELECT product_name, price, stock_qty FROM Product WHERE product_id = :pid FOR UPDATE",
                        {"pid": pid}
                    )
                    prod_row = cursor.fetchone()
                    if not prod_row:
                        conn.rollback()
                        return jsonify({"error": f"ORA-02291: Product #{pid} does not exist."}), 400

                    p_name, p_price, current_stock = prod_row[0], float(prod_row[1]), int(prod_row[2])

                    # Business rule check: Insufficient stock
                    if current_stock < qty:
                        conn.rollback()
                        return jsonify({
                            "error": f"Insufficient stock for '{p_name}'. Available: {current_stock}, Requested: {qty}."
                        }), 400

                    line_total = p_price * qty
                    order_total += line_total
                    verified_items.append({
                        "product_id": pid,
                        "product_name": p_name,
                        "unit_price": p_price,
                        "quantity": qty
                    })

                # 3. Insert Orders Record and Retrieve generated order_id
                order_id_var = cursor.var(int)
                cursor.execute("""
                    INSERT INTO Orders (customer_id, order_date, status)
                    VALUES (:cid, SYSDATE, 'Placed')
                    RETURNING order_id INTO :new_order_id
                """, {"cid": customer_id, "new_order_id": order_id_var})

                new_order_id = order_id_var.getvalue()[0]

                # 4. Insert Order_Item rows and reduce Product.stock_qty
                for v in verified_items:
                    # Insert line item snapshot
                    cursor.execute("""
                        INSERT INTO Order_Item (order_id, product_id, quantity, unit_price)
                        VALUES (:oid, :pid, :qty, :uprice)
                    """, {
                        "oid": new_order_id,
                        "pid": v["product_id"],
                        "qty": v["quantity"],
                        "uprice": v["unit_price"]
                    })

                    # Decrement inventory stock
                    cursor.execute("""
                        UPDATE Product
                        SET stock_qty = stock_qty - :qty
                        WHERE product_id = :pid
                    """, {"qty": v["quantity"], "pid": v["product_id"]})

                # 5. Insert Payment record (1:1 with Orders)
                # For COD: payment_status is 'Pending', payment_date is NULL
                # For Online methods: can be initiated as 'Pending' or 'Paid'
                cursor.execute("""
                    INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status)
                    VALUES (:oid, :pmethod, NULL, :amt, 'Pending')
                """, {
                    "oid": new_order_id,
                    "pmethod": payment_method,
                    "amt": order_total
                })

                # 6. COMMIT TRANSACTION
                conn.commit()

                return jsonify({
                    "message": "Order successfully placed inside an atomic ACID transaction.",
                    "order_id": new_order_id,
                    "total": order_total,
                    "order_total": order_total,
                    "status": "Placed",
                    "payment_method": payment_method
                }), 201

            except Exception as tx_err:
                # Any failure during the transaction causes an immediate ROLLBACK
                conn.rollback()
                raise tx_err

    except Exception as e:
        err = translate_oracle_error(e)
        return jsonify({"error": err["error"]}), err["status"]
