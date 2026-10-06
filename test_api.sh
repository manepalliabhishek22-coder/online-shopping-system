#!/usr/bin/env bash
# ==============================================================================
# Online Shopping System - API Test Script (curl suite)
# Demonstrates endpoints, ACID transactions, and error handling for project viva.
# ==============================================================================

BASE_URL="http://localhost:3000/api"

echo "=========================================================="
echo "1. TESTING DASHBOARD & STATS"
echo "=========================================================="
curl -s -X GET "$BASE_URL/stats" | python3 -m json.tool || curl -s -X GET "$BASE_URL/stats"
echo ""

echo "----------------------------------------------------------"
echo "1b. Revenue by Category (Doughnut chart)"
curl -s -X GET "$BASE_URL/charts/revenue-by-category"
echo ""

echo "----------------------------------------------------------"
echo "1c. Top 5 Products by Units Sold (Horizontal Bar)"
curl -s -X GET "$BASE_URL/charts/top-products"
echo ""

echo "----------------------------------------------------------"
echo "1d. Orders by Status (Pie Chart)"
curl -s -X GET "$BASE_URL/charts/orders-by-status"
echo ""

echo "----------------------------------------------------------"
echo "1e. Customer Spending (Bar Chart)"
curl -s -X GET "$BASE_URL/charts/customer-spending"
echo ""

echo "=========================================================="
echo "2. TESTING CUSTOMERS CRUD & CONSTRAINTS"
echo "=========================================================="
echo "2a. List Customers"
curl -s -X GET "$BASE_URL/customers"
echo ""

echo "2b. Add New Customer (Success)"
curl -s -X POST "$BASE_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Divya Nair","email":"divya.nair@example.com","phone":"+91 94444 11223","address":"12 Marine Drive","city":"Kochi"}'
echo ""

echo "2c. Duplicate Email Constraint Test (Should return ORA-00001 friendly error)"
curl -s -X POST "$BASE_URL/customers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Divya Duplicate","email":"divya.nair@example.com","city":"Kochi"}'
echo ""

echo "2d. Child Record FK Constraint Test (Cannot delete customer with orders - ORA-02292)"
curl -s -X DELETE "$BASE_URL/customers/1"
echo ""

echo "=========================================================="
echo "3. TESTING PRODUCTS & FILTERING"
echo "=========================================================="
echo "3a. Search Products (search=headphone)"
curl -s -X GET "$BASE_URL/products?search=headphone"
echo ""

echo "3b. Filter Products by Category (category_id=1)"
curl -s -X GET "$BASE_URL/products?category_id=1"
echo ""

echo "3c. Check Constraint Violation Test (Price <= 0)"
curl -s -X POST "$BASE_URL/products" \
  -H "Content-Type: application/json" \
  -d '{"product_name":"Faulty Item","price":-10.00,"stock_qty":10,"category_id":1}'
echo ""

echo "=========================================================="
echo "4. TESTING ACID TRANSACTION: PLACE NEW ORDER (POST /api/orders)"
echo "=========================================================="
echo "4a. Insufficient Stock Rejection Test (Atomicity & Rollback)"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":2,"payment_method":"UPI","items":[{"product_id":1,"quantity":9999}]}'
echo ""

echo "4b. Valid Order Placement (Deducts stock, creates Order, Order_Items, Payment in ONE transaction)"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{"customer_id":2,"payment_method":"Credit Card","items":[{"product_id":1,"quantity":1},{"product_id":8,"quantity":1}]}'
echo ""

echo "=========================================================="
echo "5. TESTING ORDERS & PAYMENT SETTLEMENT"
echo "=========================================================="
echo "5a. List Orders (uses order_summary view)"
curl -s -X GET "$BASE_URL/orders"
echo ""

echo "5b. Update Order Status to 'Shipped'"
curl -s -X PUT "$BASE_URL/orders/3/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"Shipped"}'
echo ""

echo "5c. Mark Payment as Paid"
curl -s -X PUT "$BASE_URL/payments/3"
echo ""

echo "=========================================================="
echo "TEST SUITE COMPLETE"
echo "=========================================================="
