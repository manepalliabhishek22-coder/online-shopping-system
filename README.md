# Online Shopping System — Admin Dashboard & DBMS Backend

A full-stack, enterprise-grade Admin Dashboard and transactional REST API for an **Online Shopping System** DBMS project. The system supports high-throughput relational data modeling, transactional order placement with strict ACID guarantees, real-time analytics visualizations with Chart.js, and dual backend implementations (Python Flask with Oracle 23ai / SQLite and Node.js Express).

---

## 📖 Project Overview

The **Online Shopping System — Admin Dashboard** is designed to provide e-commerce store administrators with real-time visibility and control over products, customer accounts, orders, inventory stock levels, and payment settlements. It bridges robust relational database constraints with a modern, responsive web dashboard.

---

## 🎯 Problem Statement

Traditional e-commerce administrative portals often face common architectural and operational challenges:
1. **Concurrency and Race Conditions**: Multiple users purchasing the last item in stock simultaneously leading to negative inventory.
2. **Orphaned and Inconsistent Records**: Partial failure during multi-step order checkout leaving orphaned payments or inventory discrepancies.
3. **Cryptic Database Exceptions**: Database constraint violations exposing internal database errors to end users rather than meaningful feedback.
4. **Complex Reporting Overheads**: Slow aggregated reporting across high-volume transaction tables without optimized SQL Views and indexed joins.

This project solves these challenges through pessimistic locking (`FOR UPDATE`), atomic ACID multi-table transactions with rollback mechanisms, friendly database constraint error mapping (`ORA-00001`, `ORA-02291`, `ORA-02292`, `ORA-02290`), and materialized view aggregations.

---

## ✨ Key Features

### 🖥️ 1. Modern Admin Dashboard (Frontend)
- **Responsive Layout**: Desktop sidebar navigation collapsing into a mobile-friendly drawer menu.
- **Dark / Light Theme Toggle**: Persistent user theme preferences saved via `localStorage` with CSS variable design tokens.
- **Interactive Analytics (Chart.js)**:
  - **Revenue by Category**: Doughnut chart visualizing sales distribution.
  - **Top 5 Best-Selling Products**: Horizontal bar chart tracking product popularity.
  - **Orders by Status**: Pie chart tracking fulfillment stages (`Placed`, `Shipped`, `Delivered`, `Cancelled`).
  - **Customer Lifetime Spending**: Vertical bar chart highlighting top-tier customers.
- **Live Inventory Health & Low-Stock Alerts**: Instant visual badges for items with `< 50` units remaining.
- **Transactional Order Placement Modal**: Multi-item line builder with live price calculation and instant stock validation.
- **XSS Sanitization**: Frontend HTML sanitization (`escapeHtml`) on all user-supplied input strings.

### ⚙️ 2. High-Performance Backend & Relational Database Layer
- **Dual Backend Architecture**:
  - **Python Flask**: Blueprint-driven modular architecture (`dashboard`, `customers`, `categories`, `products`, `orders`, `payments`).
  - **Node.js / Express**: TypeScript-powered API server for flexible execution environments.
- **Oracle 23ai & SQLite Support**:
  - **Oracle 23ai**: Thin Mode connectivity via `python-oracledb` with connection pooling (`min=2, max=10`).
  - **SQLite**: Zero-configuration local database (`shopping_system.db`) with foreign key enforcement enabled (`PRAGMA foreign_keys = ON`).
- **ACID Transaction Guarantees**:
  - Validates stock, decrements inventory, creates order records, attaches line items, and generates payment status atomically.
  - Automatic rollback (`conn.rollback()`) on any failure step.
- **SQL Injection Prevention**: 100% parameterized bind variables across all queries.
- **Oracle / SQL Error Mapping**: Converts raw database constraint violations into clear, user-friendly JSON responses.

---

## 🛠️ Technologies Used

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Custom Design System & Dark Mode), Modern JavaScript (ES6+), Chart.js |
| **Backend (Python)** | Python 3.10+, Flask, `flask-cors`, `python-dotenv`, `python-oracledb` |
| **Backend (Node.js)** | Node.js, TypeScript, Express, `node:sqlite`, `tsx`, Vite |
| **Database** | Oracle Database 23ai (Free / Enterprise) / SQLite 3 |
| **Tooling & Scripts** | Bash (`test_api.sh`), Git |

---

## 🗂️ Project Structure

```text
online-shopping-system-admin-dashboard/
├── .env.example            # Environment configuration template
├── .gitignore              # Git ignore rules for Python, Node, and OS files
├── README.md               # Project documentation & execution guide
├── metadata.json           # Application metadata
├── requirements.txt        # Python backend dependencies
├── package.json            # Node.js backend & frontend tooling dependencies
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build tool configuration
├── schema.sql              # Oracle 23ai DDL schema, constraints, views & seed data
├── init_db.py              # SQLite database initializer and seeder script
├── db.py                   # Unified database connection pool & error handler
├── app.py                  # Python Flask main entry point
├── server.ts               # Node.js / Express TypeScript entry point
├── test_api.sh             # Comprehensive API test suite using curl
├── routes/                 # Python Flask Route Blueprints
│   ├── __init__.py
│   ├── categories.py       # Category endpoints
│   ├── customers.py        # Customer CRUD endpoints & constraint handling
│   ├── dashboard.py        # KPI metrics & 4 Chart.js analytics endpoints
│   ├── orders.py           # Order management & ACID transaction placement
│   ├── payments.py         # Payment settlement endpoints
│   └── products.py         # Product catalog management & live filtering
├── frontend/               # Static Web Dashboard Assets
│   ├── index.html          # Semantic HTML5 single-page application
│   ├── style.css           # Responsive design system & dark mode styles
│   └── app.js              # Frontend UI controller, Chart.js integrations & API client
└── src/                    # TypeScript / React component scaffolding
    ├── App.tsx
    ├── main.tsx
    └── index.css
```

---

## 🗄️ Database Schema & Relational Design

```
+------------------+         1 : N         +------------------+
|     Customer     | --------------------> |      Orders      |
+------------------+                       +------------------+
| customer_id (PK) |                                | 1
| name             |                                |
| email (UNIQUE)   |                                | 1 : N
| phone            |                                v
| address, city    |                       +------------------+
+------------------+                       |    Order_Item    |
                                           +------------------+
+------------------+         1 : N         | order_id (PK,FK) |
|     Category     | --------------------> | product_id(PK,FK)|
+------------------+                       | quantity (>0)    |
| category_id (PK) |                       | unit_price (>0)  |
| category_name(UQ)|                       +------------------+
| description      |                                ^
+------------------+                                | N : 1
                                           +------------------+
+------------------+         1 : 1         |     Product      |
|     Payment      | <-------------------- +------------------+
+------------------+                       | product_id (PK)  |
| payment_id (PK)  |                       | product_name     |
| order_id (FK,UQ) |                       | price (>0)       |
| payment_method   |                       | stock_qty (>=0)  |
| amount, status   |                       | category_id (FK) |
+------------------+                       +------------------+
```

### SQL View: `order_summary`
Aggregates order header, customer name, fulfillment status, total calculated price, and payment status into a single view for efficient dashboard rendering.

---

## ⚙️ System Requirements

- **Python**: Python 3.10 or higher
- **Node.js**: Node.js v18.0.0 or higher (optional for Node server/Vite tooling)
- **Database**:
  - **SQLite 3** (Included out of the box with zero setup) OR
  - **Oracle Database 23ai** (Local instance or Docker container)

---

## 🚀 Installation & Setup Guide

### 1. Clone the Repository
```bash
git clone https://github.com/manepalliabhishek22-coder/online-shopping-system.git
cd online-shopping-system
```

### 2. Configure Environment Variables
Create your local `.env` file from the provided template:
```bash
cp .env.example .env
```

Edit `.env` to configure your database settings if using Oracle 23ai:
```ini
DB_TYPE=sqlite
DB_FILE=shopping_system.db

# Oracle 23ai Configuration (Only required if DB_TYPE=oracle)
DB_USER=c##shop_admin
DB_PASSWORD=MySecurePassword123
DB_DSN=localhost:1521/FREEPDB1
PORT=5000
FLASK_ENV=development
```

---

## 🗃️ Database Setup

### Option A: Local SQLite (Zero Setup — Recommended for Quick Start)
The local SQLite database will automatically initialize and seed on the first run. Alternatively, you can explicitly initialize it:
```bash
python init_db.py
```

### Option B: Oracle 23ai Database Setup
Run the SQL script using SQL*Plus, SQLcl, or Oracle SQL Developer:
```bash
sqlplus c##shop_admin/MySecurePassword123@localhost:1521/FREEPDB1
@schema.sql
```

---

## 🏃 How to Run the Application

### Method 1: Running with Python Flask (Default)
1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Start the Flask server**:
   ```bash
   python app.py
   ```
3. **Open the application**:
   Visit [http://localhost:5000](http://localhost:5000) in your web browser.

### Method 2: Running with Node.js / Express
1. **Install npm dependencies**:
   ```bash
   npm install
   ```
2. **Start the development server**:
   ```bash
   npm run dev
   ```
3. **Open the application**:
   Visit [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Testing the API Endpoints

Execute the automated test script to verify all REST endpoints, constraint validations, and ACID transaction rollbacks:

```bash
chmod +x test_api.sh
./test_api.sh
```

### Key Endpoint Highlights:
- `GET /api/stats` — Aggregate metrics for dashboard cards.
- `GET /api/charts/revenue-by-category` — Revenue grouped by category.
- `GET /api/charts/top-products` — Top 5 best selling products.
- `GET /api/charts/orders-by-status` — Order fulfillment breakdown.
- `GET /api/charts/customer-spending` — Customer lifetime value.
- `GET /api/products?search=wireless&category_id=1` — Search & filter products.
- `POST /api/orders` — Atomically place an order, decrement stock, and create payment.
- `PUT /api/orders/<order_id>/status` — Update order progress (`Placed` -> `Shipped` -> `Delivered`).
- `PUT /api/payments/<payment_id>` — Settle pending payment.

---

## 🛡️ Security & Integrity Practices

- **Zero Secret Exposure**: `.env` and sensitive local files are ignored via `.gitignore`.
- **SQL Injection Prevention**: Parameterized queries and bind variables throughout Python and Node layers.
- **Cross-Site Scripting (XSS) Protection**: Client-side sanitization prevents malicious content rendering.
- **Foreign Key Integrity**: Prevents cascading deletion of active records without user awareness (`ORA-02292`).

---

## 🔮 Future Enhancements

- [ ] Add JWT-based multi-role authentication (Admin, Manager, Customer Support).
- [ ] Export sales reports to PDF and CSV formats.
- [ ] Real-time inventory alerts via WebSockets.
- [ ] Integration with third-party payment gateways (Stripe, Razorpay).
- [ ] Audit log tracking for admin actions and status updates.

---

## 👥 Authors & Project Team

Developed as a DBMS Academic Project:
- **Manepalli Abhishek** (Reg: `25B11CS561`)
- **Guru kiran Gowda** (Reg: `25B11CS329`)
- **Upparapalli Devi Sri** (Reg: `25B11CS971`)
- **Kandipilli Hema Sankara VaraPrasad** (Reg: `25B11CS395`)

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
