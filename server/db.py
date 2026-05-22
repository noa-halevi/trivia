from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import cast

import aiosqlite

DB_PATH = str(Path(__file__).resolve().parents[1] / "data" / "trivia_questions.db")
QuestionRow = dict[str, str | int]


def row_text(row: aiosqlite.Row, key: str) -> str:
    return str(row[key])  # pyright: ignore[reportAny]


async def get_db() -> aiosqlite.Connection:
    return await aiosqlite.connect(DB_PATH)


async def init_db() -> None:
    db = await get_db()
    try:
        _ = await db.execute(
            """
            CREATE TABLE IF NOT EXISTS game_logs (
                room_id TEXT,
                player_name TEXT,
                final_score INT,
                timestamp TEXT,
                questions_correct INT,
                helps_used INT
            )
            """
        )
        await db.commit()
    finally:
        await db.close()


async def get_questions_by_difficulty(difficulty: int, n: int) -> list[QuestionRow]:
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        table_name = await get_questions_table_name(db)
        cursor = await db.execute(
            f"""
            SELECT *
            FROM {table_name}
            WHERE difficulty = ?
            ORDER BY RANDOM()
            LIMIT ?
            """,
            (difficulty, n),
        )
        rows = await cursor.fetchall()
        await cursor.close()
        return [
            {
                "id": int(row_text(row, "id")),
                "question": row_text(row, "question"),
                "correct_answer": row_text(row, "correct_answer"),
                "wrong_answer_1": row_text(row, "wrong_answer_1"),
                "wrong_answer_2": row_text(row, "wrong_answer_2"),
                "wrong_answer_3": row_text(row, "wrong_answer_3"),
                "difficulty": int(row_text(row, "difficulty")),
            }
            for row in rows
        ]
    finally:
        await db.close()


async def get_questions_table_name(db: aiosqlite.Connection) -> str:
    cursor = await db.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name IN ('questions', 'trivia_questions')
        ORDER BY CASE name WHEN 'questions' THEN 0 ELSE 1 END
        LIMIT 1
        """
    )
    row = await cursor.fetchone()
    await cursor.close()
    if row is None:
        raise RuntimeError("No questions table found. Expected 'questions' or 'trivia_questions'.")
    return row_text(row, "name")


async def save_game_log(player: Mapping[str, object], room_id: str) -> None:
    helps_used = player.get("helps_used", {})
    helps_used_count = 0
    if isinstance(helps_used, dict):
        helps_used_mapping = cast(Mapping[str, object], helps_used)
        help_values: list[object] = list(helps_used_mapping.values())
        helps_used_count = sum(1 for was_used in help_values if bool(was_used))

    db = await get_db()
    try:
        _ = await db.execute(
            """
            INSERT INTO game_logs (
                room_id,
                player_name,
                final_score,
                timestamp,
                questions_correct,
                helps_used
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                room_id,
                str(player["name"]),
                int(str(player["score"])),
                datetime.now(timezone.utc).isoformat(),
                int(str(player["questions_correct"])),
                helps_used_count,
            ),
        )
        await db.commit()
    finally:
        await db.close()


async def get_player_stats() -> list[dict[str, str | int | float]]:
    db = await get_db()
    try:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            """
            SELECT
                player_name,
                COUNT(*) AS games,
                AVG(final_score) AS avg_final_score,
                MAX(final_score) AS max_final_score,
                AVG(questions_correct) AS avg_questions_correct
            FROM game_logs
            GROUP BY player_name
            ORDER BY max_final_score DESC
            """
        )
        rows = await cursor.fetchall()
        await cursor.close()
        return [
            {
                "player_name": row_text(row, "player_name"),
                "games": int(row_text(row, "games")),
                "avg_final_score": float(row_text(row, "avg_final_score")),
                "max_final_score": int(row_text(row, "max_final_score")),
                "avg_questions_correct": float(row_text(row, "avg_questions_correct")),
            }
            for row in rows
        ]
    finally:
        await db.close()
