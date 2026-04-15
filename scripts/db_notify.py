#!/usr/bin/env python3
"""
db_notify — shared helper for inserting in-app notifications into PostgreSQL.

Usage:
    from db_notify import broadcast_notification, user_notification

broadcast_notification: inserts one row per user in the users table.
user_notification: inserts a notification for a single specific user.
"""

import json
import logging
import psycopg2
import psycopg2.extras

logger = logging.getLogger("db_notify")


def broadcast_notification(
    db_url: str,
    ntype: str,
    title: str,
    body: str,
    ticker: str | None = None,
    data: dict | None = None,
    severity: str = "info",
) -> int:
    """
    Insert one notification row per user.
    Returns the number of rows inserted (= number of users at call time).
    New users who sign up later won't see this broadcast — acceptable for live alerts.
    """
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("SELECT id FROM users")
        user_ids = [row[0] for row in cur.fetchall()]

        if not user_ids:
            logger.info("[db_notify] No users found — broadcast skipped (%s)", ntype)
            cur.close()
            conn.close()
            return 0

        data_json = json.dumps(data or {})
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO notifications (user_id, type, title, body, ticker, data, severity)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            [(str(uid), ntype, title, body, ticker, data_json, severity) for uid in user_ids],
        )
        cur.close()
        conn.close()
        logger.info("[db_notify] broadcast '%s' → %d users", ntype, len(user_ids))
        return len(user_ids)
    except Exception as e:
        logger.error("[db_notify] broadcast failed (%s): %s", ntype, e)
        return 0


def user_notification(
    db_url: str,
    user_id: str,
    ntype: str,
    title: str,
    body: str,
    ticker: str | None = None,
    data: dict | None = None,
    severity: str = "info",
) -> bool:
    """Insert a notification for a single user. Returns True on success."""
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO notifications (user_id, type, title, body, ticker, data, severity)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (str(user_id), ntype, title, body, ticker, json.dumps(data or {}), severity),
        )
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error("[db_notify] user_notification failed (%s, user=%s): %s", ntype, user_id, e)
        return False
