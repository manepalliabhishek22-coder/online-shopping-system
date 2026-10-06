"""
Database Initializer Script
Creates and seeds 'shopping_system.db' with the complete relational schema:
- Customer (with college team members)
- Category
- Product (with check constraints: price > 0, stock_qty >= 0)
- Orders
- Order_Item (composite PK, quantity > 0)
- Payment (1:1 with Orders)
- View order_summary
"""

import sqlite3
import os
from datetime import datetime, timedelta

DB_FILE = "shopping_system.db"

def init_database():
    print(f"Creating database file: {DB_FILE}...")
    
    # Remove existing database if rebuilding
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)

    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    # 1. Customer Table
    cursor.execute("""
        CREATE TABLE Customer (
            customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone TEXT,
            address TEXT,
            city TEXT NOT NULL
        );
    """)

    # 2. Category Table
    cursor.execute("""
        CREATE TABLE Category (
            category_id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_name TEXT NOT NULL UNIQUE,
            description TEXT
        );
    """)

    # 3. Product Table
    cursor.execute("""
        CREATE TABLE Product (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT NOT NULL,
            price REAL NOT NULL CHECK(price > 0),
            stock_qty INTEGER NOT NULL CHECK(stock_qty >= 0),
            category_id INTEGER NOT NULL REFERENCES Category(category_id)
        );
    """)

    # 4. Orders Table
    cursor.execute("""
        CREATE TABLE Orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES Customer(customer_id),
            order_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Placed' CHECK(status IN ('Placed', 'Shipped', 'Delivered', 'Cancelled'))
        );
    """)

    # 5. Order_Item Table
    cursor.execute("""
        CREATE TABLE Order_Item (
            order_id INTEGER NOT NULL REFERENCES Orders(order_id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES Product(product_id),
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            unit_price REAL NOT NULL CHECK(unit_price > 0),
            PRIMARY KEY (order_id, product_id)
        );
    """)

    # 6. Payment Table
    cursor.execute("""
        CREATE TABLE Payment (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL UNIQUE REFERENCES Orders(order_id) ON DELETE CASCADE,
            payment_method TEXT NOT NULL CHECK(payment_method IN ('UPI', 'Credit Card', 'COD')),
            payment_date TEXT,
            amount REAL NOT NULL CHECK(amount >= 0),
            payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending', 'Paid', 'Failed'))
        );
    """)

    # 7. View: order_summary
    cursor.execute("""
        CREATE VIEW order_summary AS
        SELECT 
            o.order_id,
            c.name AS customer,
            o.order_date,
            o.status,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS order_total,
            COALESCE(p.payment_status, 'Pending') AS payment_status
        FROM Orders o
        JOIN Customer c ON o.customer_id = c.customer_id
        LEFT JOIN Order_Item oi ON o.order_id = oi.order_id
        LEFT JOIN Payment p ON o.order_id = p.order_id
        GROUP BY o.order_id, c.name, o.order_date, o.status, p.payment_status;
    """)

    # =========================================================================
    # SEED DATA
    # =========================================================================
    now = datetime.utcnow()
    d_minus_6 = (now - timedelta(days=6)).isoformat() + "Z"
    d_minus_4 = (now - timedelta(days=4)).isoformat() + "Z"
    d_minus_2 = (now - timedelta(days=2)).isoformat() + "Z"
    d_now = now.isoformat() + "Z"

    # Seed Customers (College Project Team Members)
    customers = [
        ("Manepalli Abhishek", "25B11CS561@college.edu", "25B11CS561", "Dept of CSE, Block A", "Visakhapatnam"),
        ("Guru kiran Gowda", "25B11CS329@college.edu", "25B11CS329", "Dept of CSE, Block B", "Bengaluru"),
        ("Upparapalli Devi Sri", "25B11CS971@college.edu", "25B11CS971", "Dept of CSE, Block A", "Tirupati"),
        ("Kandipilli Hema Sankara VaraPrasad", "25B11CS395@college.edu", "25B11CS395", "Dept of CSE, Block C", "Kakinada"),
    ]
    cursor.executemany("INSERT INTO Customer (name, email, phone, address, city) VALUES (?, ?, ?, ?, ?);", customers)

    # Seed Categories
    categories = [
        ("Electronics", "Smartphones, audio, and personal computers"),
        ("Footwear & Fashion", "Apparel, sneakers, formal wear and accessories"),
        ("Home & Kitchen", "Appliances, cookware, and smart decor"),
        ("Fitness & Sports", "Workout equipment, yoga gear, and athletic shoes"),
        ("Books & Stationery", "Academic textbooks, fiction, and premium journals"),
    ]
    cursor.executemany("INSERT INTO Category (category_name, description) VALUES (?, ?);", categories)

    # Seed Products
    products = [
        ("Noise-Cancelling Wireless Headphones", 4999.00, 42, 1),
        ("4K Smart LED Display 55-inch", 34999.00, 18, 1),
        ("Ergonomic Office Chair", 8499.00, 85, 3),
        ("Stainless Steel Chef Pan Set", 2999.00, 120, 3),
        ("Running Breathable Sneakers", 2499.00, 36, 2),
        ("Mechanical Gaming Keyboard", 3299.00, 64, 1),
        ("Smart Fitness Band Pro", 1899.00, 110, 4),
        ("Premium Leather Bifold Wallet", 999.00, 140, 2),
        ("Hardcover Leather Daily Planner", 499.00, 210, 5),
        ("Resistance Exercise Bands Set", 799.00, 95, 4),
    ]
    cursor.executemany("INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES (?, ?, ?, ?);", products)

    # Seed Orders
    orders = [
        (1, d_minus_6, "Delivered"),
        (2, d_minus_4, "Shipped"),
        (3, d_minus_2, "Placed"),
        (4, d_now, "Placed"),
    ]
    cursor.executemany("INSERT INTO Orders (customer_id, order_date, status) VALUES (?, ?, ?);", orders)

    # Seed Order Items
    order_items = [
        (1, 1, 2, 4999.00),
        (1, 8, 1, 999.00),
        (2, 2, 1, 34999.00),
        (3, 3, 1, 8499.00),
        (3, 7, 2, 1899.00),
        (4, 5, 2, 2499.00),
    ]
    cursor.executemany("INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?);", order_items)

    # Seed Payments
    payments = [
        (1, "UPI", d_minus_6, 10997.00, "Paid"),
        (2, "Credit Card", d_minus_4, 34999.00, "Paid"),
        (3, "UPI", None, 12297.00, "Pending"),
        (4, "COD", None, 4998.00, "Pending"),
    ]
    cursor.executemany("INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status) VALUES (?, ?, ?, ?, ?);", payments)

    conn.commit()
    conn.close()
    print("Database 'shopping_system.db' successfully initialized and seeded with all tables, constraints, and views!")

if __name__ == "__main__":
    init_database()
