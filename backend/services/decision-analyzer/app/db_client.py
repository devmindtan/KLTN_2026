"""
Database client for decision analyzer
Handles PostgreSQL connections and queries
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def get_db_connection():
    """Create and return PostgreSQL connection"""
    try:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=os.getenv("POSTGRES_PORT", "5432"),
            database=os.getenv("POSTGRES_DBS", "kltn_db"),
            user=os.getenv("POSTGRES_USERNAME", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", ""),
            connect_timeout=10,
        )
        logger.info(f"Connected to {os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}")
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise


def close_db_connection(conn):
    """Close database connection"""
    if conn:
        conn.close()
        logger.info("Database connection closed")


def query_dict(conn, query: str, params: tuple = ()):
    """Execute query and return results as list of dicts"""
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, params)
        results = cursor.fetchall()
        cursor.close()
        return [dict(row) for row in results]
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise


def query_scalar(conn, query: str, params: tuple = ()):
    """Execute query and return single value"""
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        result = cursor.fetchone()
        cursor.close()
        return result[0] if result else None
    except Exception as e:
        logger.error(f"Query failed: {e}")
        raise
