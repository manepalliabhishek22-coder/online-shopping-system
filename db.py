"""
Database connection pool and query execution layer.
Supports both:
1. Local SQLite persistent database (shopping_system.db) - works out of the box with zero setup.
2. Oracle 23ai connection pool (python-oracledb thin mode) - configured via .env.
"""

import os
import sqlite3
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

DB_TYPE = os.getenv("DB_TYPE", "sqlite").lower()
DB_FILE = os.getenv("DB_FILE", "shopping_system.db")

DB_USER = os.getenv("DB_USER", "c##shop_admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "MySecurePassword123")
DB_DSN = os.getenv("DB_DSN", "localhost:1521/FREEPDB1")

# Global Oracle connection pool
_oracle_pool = None

def init_oracle_pool():
    """Initializes the Oracle 23ai connection pool in thin mode."""
    global _oracle_pool
    if _oracle_pool is None:
        try:
            import oracledb
            _oracle_pool = oracledb.create_pool(
                user=DB_USER,
                password=DB_PASSWORD,
                dsn=DB_DSN,
                min=2,
                max=10,
                increment=1
            )
            print(f"Connected to Oracle 23ai connection pool ({DB_DSN})")
        except Exception as e:
            print(f"Notice: Oracle connection not available: {e}. Falling back to local database '{DB_FILE}'.")
            _oracle_pool = None
    return _oracle_pool

@contextmanager
def get_db():
    """
    Unified context manager that yields a database connection.
    Safely commits/closes or releases connection back to the pool.
    """
    if DB_TYPE == "oracle":
        pool = init_oracle_pool()
        if pool:
            conn = pool.acquire()
            try:
                yield conn
            finally:
                pool.release(conn)
            return

    # Default: Local Relational Database (shopping_system.db)
    if not os.path.exists(DB_FILE):
        from init_db import init_database
        init_database()

    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

def rows_to_dict_list(cursor):
    """Converts cursor description and rows into a list of dictionaries with lowercase keys."""
    if not cursor.description:
        return []
    columns = [col[0].lower() for col in cursor.description]
    results = []
    for row in cursor.fetchall():
        row_dict = {}
        for col_name, val in zip(columns, row):
            if hasattr(val, "isoformat"):
                row_dict[col_name] = val.isoformat()
            else:
                row_dict[col_name] = val
        results.append(row_dict)
    return results

def translate_oracle_error(e: Exception) -> dict:
    """
    Translates cryptic database errors into friendly, descriptive messages.
    Handles both Oracle ORA- error codes and relational SQLite constraint exceptions.
    """
    error_msg = str(e)

    if "ORA-00001" in error_msg or "UNIQUE constraint failed" in error_msg:
        return {
            "error": "A record with this unique value (such as email or category name) already exists in the system.",
            "code": "ORA-00001",
            "status": 400
        }
    elif "ORA-02291" in error_msg or "FOREIGN KEY constraint failed" in error_msg:
        return {
            "error": "Integrity constraint violated: Referenced parent record (e.g. customer_id or category_id) does not exist.",
            "code": "ORA-02291",
            "status": 400
        }
    elif "ORA-02292" in error_msg:
        return {
            "error": "Cannot delete or modify record because related child records exist (e.g. customer has placed orders).",
            "code": "ORA-02292",
            "status": 400
        }
    elif "ORA-02290" in error_msg or "CHECK constraint failed" in error_msg:
        return {
            "error": "Validation check constraint failed (e.g. price must be > 0, stock_qty >= 0, or invalid status value).",
            "code": "ORA-02290",
            "status": 400
        }
    else:
        return {
            "error": f"Database operation failed: {error_msg}",
            "code": "ORA-UNKNOWN",
            "status": 500
        }
