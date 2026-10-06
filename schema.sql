-- ============================================================================
-- ONLINE SHOPPING SYSTEM - ORACLE 23ai DATABASE SCHEMA
-- DBMS College Project
-- ============================================================================

-- Clean up existing database objects (if re-running script)
BEGIN
   EXECUTE IMMEDIATE 'DROP VIEW order_summary';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE Payment CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE Order_Item CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE Orders CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE Product CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE Category CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
   EXECUTE IMMEDIATE 'DROP TABLE Customer CASCADE CONSTRAINTS';
EXCEPTION
   WHEN OTHERS THEN IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

-- ============================================================================
-- 1. CUSTOMER TABLE
-- Stores shoppers' demographic & contact information.
-- ============================================================================
CREATE TABLE Customer (
    customer_id NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) NOT NULL CONSTRAINT uk_customer_email UNIQUE,
    phone VARCHAR2(25),
    address VARCHAR2(255),
    city VARCHAR2(100) NOT NULL
);

-- ============================================================================
-- 2. CATEGORY TABLE
-- Classification categories for products.
-- ============================================================================
CREATE TABLE Category (
    category_id NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    category_name VARCHAR2(100) NOT NULL CONSTRAINT uk_category_name UNIQUE,
    description VARCHAR2(255)
);

-- ============================================================================
-- 3. PRODUCT TABLE
-- Stores product specifications, unit pricing, inventory stock.
-- Checks: price > 0, stock_qty >= 0.
-- ============================================================================
CREATE TABLE Product (
    product_id NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1) PRIMARY KEY,
    product_name VARCHAR2(150) NOT NULL,
    price NUMBER(10, 2) NOT NULL CONSTRAINT chk_product_price CHECK (price > 0),
    stock_qty NUMBER(10) NOT NULL CONSTRAINT chk_product_stock CHECK (stock_qty >= 0),
    category_id NUMBER NOT NULL CONSTRAINT fk_product_category REFERENCES Category(category_id)
);

-- ============================================================================
-- 4. ORDERS TABLE
-- Captures high-level order header details.
-- Status defaults to 'Placed'.
-- ============================================================================
CREATE TABLE Orders (
    order_id NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 101 INCREMENT BY 1) PRIMARY KEY,
    customer_id NUMBER NOT NULL CONSTRAINT fk_orders_customer REFERENCES Customer(customer_id),
    order_date DATE DEFAULT SYSDATE NOT NULL,
    status VARCHAR2(20) DEFAULT 'Placed' NOT NULL CONSTRAINT chk_order_status CHECK (status IN ('Placed', 'Shipped', 'Delivered', 'Cancelled'))
);

-- ============================================================================
-- 5. ORDER_ITEM TABLE
-- Associates products with orders in an M:N relationship with quantity & snapshot price.
-- Composite Primary Key: (order_id, product_id).
-- Checks: quantity > 0.
-- ============================================================================
CREATE TABLE Order_Item (
    order_id NUMBER NOT NULL CONSTRAINT fk_order_item_order REFERENCES Orders(order_id) ON DELETE CASCADE,
    product_id NUMBER NOT NULL CONSTRAINT fk_order_item_product REFERENCES Product(product_id),
    quantity NUMBER(10) NOT NULL CONSTRAINT chk_item_quantity CHECK (quantity > 0),
    unit_price NUMBER(10, 2) NOT NULL CONSTRAINT chk_item_unit_price CHECK (unit_price > 0),
    CONSTRAINT pk_order_item PRIMARY KEY (order_id, product_id)
);

-- ============================================================================
-- 6. PAYMENT TABLE
-- 1:1 relationship with Orders for financial settlement tracking.
-- ============================================================================
CREATE TABLE Payment (
    payment_id NUMBER GENERATED ALWAYS AS IDENTITY (START WITH 201 INCREMENT BY 1) PRIMARY KEY,
    order_id NUMBER NOT NULL CONSTRAINT uk_payment_order UNIQUE CONSTRAINT fk_payment_order REFERENCES Orders(order_id) ON DELETE CASCADE,
    payment_method VARCHAR2(50) NOT NULL CONSTRAINT chk_payment_method CHECK (payment_method IN ('UPI', 'Credit Card', 'COD')),
    payment_date DATE,
    amount NUMBER(10, 2) NOT NULL CONSTRAINT chk_payment_amount CHECK (amount >= 0),
    payment_status VARCHAR2(20) DEFAULT 'Pending' NOT NULL CONSTRAINT chk_payment_status CHECK (payment_status IN ('Pending', 'Paid', 'Failed'))
);

-- ============================================================================
-- 7. VIEW: ORDER_SUMMARY
-- Aggregates orders, customer details, line item sums, and payment status.
-- (Required for GET /api/orders)
-- ============================================================================
CREATE OR REPLACE VIEW order_summary AS
SELECT 
    o.order_id,
    c.name AS customer,
    TO_CHAR(o.order_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS order_date,
    o.status,
    NVL(SUM(oi.quantity * oi.unit_price), 0) AS order_total,
    NVL(p.payment_status, 'Pending') AS payment_status
FROM Orders o
JOIN Customer c ON o.customer_id = c.customer_id
LEFT JOIN Order_Item oi ON o.order_id = oi.order_id
LEFT JOIN Payment p ON o.order_id = p.order_id
GROUP BY 
    o.order_id, 
    c.name, 
    o.order_date, 
    o.status, 
    p.payment_status;

-- ============================================================================
-- SAMPLE DATA INSERTIONS (SEED DATA)
-- ============================================================================

-- Customers
INSERT INTO Customer (name, email, phone, address, city) VALUES ('Manepalli Abhishek', '25B11CS561@college.edu', '25B11CS561', 'Dept of CSE, Block A', 'Visakhapatnam');
INSERT INTO Customer (name, email, phone, address, city) VALUES ('Guru kiran Gowda', '25B11CS329@college.edu', '25B11CS329', 'Dept of CSE, Block B', 'Bengaluru');
INSERT INTO Customer (name, email, phone, address, city) VALUES ('Upparapalli Devi Sri', '25B11CS971@college.edu', '25B11CS971', 'Dept of CSE, Block A', 'Tirupati');
INSERT INTO Customer (name, email, phone, address, city) VALUES ('Kandipilli Hema Sankara VaraPrasad', '25B11CS395@college.edu', '25B11CS395', 'Dept of CSE, Block C', 'Kakinada');

-- Categories
INSERT INTO Category (category_name, description) VALUES ('Electronics', 'Smartphones, audio, and personal computers');
INSERT INTO Category (category_name, description) VALUES ('Footwear & Fashion', 'Apparel, sneakers, formal wear and accessories');
INSERT INTO Category (category_name, description) VALUES ('Home & Kitchen', 'Appliances, cookware, and smart decor');
INSERT INTO Category (category_name, description) VALUES ('Fitness & Sports', 'Workout equipment, yoga gear, and athletic shoes');
INSERT INTO Category (category_name, description) VALUES ('Books & Stationery', 'Academic textbooks, fiction, and premium journals');

-- Products
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Noise-Cancelling Wireless Headphones', 4999.00, 42, 1);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('4K Smart LED Display 55-inch', 34999.00, 18, 1);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Ergonomic Office Chair', 8499.00, 85, 3);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Stainless Steel Chef Pan Set', 2999.00, 120, 3);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Running Breathable Sneakers', 2499.00, 36, 2);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Mechanical Gaming Keyboard', 3299.00, 64, 1);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Smart Fitness Band Pro', 1899.00, 110, 4);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Premium Leather Bifold Wallet', 999.00, 140, 2);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Hardcover Leather Daily Planner', 499.00, 210, 5);
INSERT INTO Product (product_name, price, stock_qty, category_id) VALUES ('Resistance Exercise Bands Set', 799.00, 95, 4);

-- Orders
INSERT INTO Orders (customer_id, order_date, status) VALUES (1, SYSDATE - 6, 'Delivered');
INSERT INTO Orders (customer_id, order_date, status) VALUES (2, SYSDATE - 4, 'Shipped');
INSERT INTO Orders (customer_id, order_date, status) VALUES (3, SYSDATE - 2, 'Placed');
INSERT INTO Orders (customer_id, order_date, status) VALUES (4, SYSDATE, 'Placed');

-- Order Items
INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (101, 1, 2, 4999.00);
INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (101, 8, 1, 999.00);
INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (102, 2, 1, 34999.00);
INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (103, 3, 1, 8499.00);
INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (103, 7, 2, 1899.00);
INSERT INTO Order_Item (order_id, product_id, quantity, unit_price) VALUES (104, 5, 2, 2499.00);

-- Payments
INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status) VALUES (101, 'UPI', SYSDATE - 6, 10997.00, 'Paid');
INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status) VALUES (102, 'Credit Card', SYSDATE - 4, 34999.00, 'Paid');
INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status) VALUES (103, 'UPI', NULL, 12297.00, 'Pending');
INSERT INTO Payment (order_id, payment_method, payment_date, amount, payment_status) VALUES (104, 'COD', NULL, 4998.00, 'Pending');

COMMIT;
