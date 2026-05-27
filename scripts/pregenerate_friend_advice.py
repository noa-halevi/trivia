#!/usr/bin/env python3
"""Pregenerate Prof. Trivius Call-a-Friend hints (JSON/CSV), then load into SQLite."""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import random
import sqlite3
import sys
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel
from pydantic_ai import Agent

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.friend import SYSTEM_PROMPT, FriendAdvice  # noqa: E402

DATA_DIR = ROOT / "data"
QUESTIONS_JSON_PATH = DATA_DIR / "final_with_hard_trivia_questions.json"
QUESTIONS_CSV_PATH = DATA_DIR / "final_with_hard_trivia_questions.csv"
FRIEND_ADVICE_JSON_PATH = DATA_DIR / "friend_advice.json"
FRIEND_ADVICE_CSV_PATH = DATA_DIR / "friend_advice.csv"
SQLITE_DB_PATH = DATA_DIR / "trivia_questions.db"

BATCH_SIZE = 25
BATCH_PAUSE_SECONDS = 3
TRUNCATE_LEN = 70
DEFAULT_MODEL = "openai:gpt-4o"

FALLBACK_ADVICE = (
    "I'm having a brain freeze on this one — trust your gut and go with your best guess. "
    "You've got this!"
)
FALLBACK_CONFIDENCE = 75


class QuotaExhaustedError(RuntimeError):
    """OpenAI account has no remaining quota; stop the run and save progress."""


def is_quota_error(error: Exception) -> bool:
    message = str(error).lower()
    return "insufficient_quota" in message or "exceeded your current quota" in message


class FriendAdviceRow(BaseModel):
    question: str
    friend_advice: str
    friend_confidence: int


class QuestionRow(BaseModel):
    question: str
    correct_answer: str
    wrong_answer_1: str
    wrong_answer_2: str
    wrong_answer_3: str
    difficulty: int


def truncate(text: str, max_len: int = TRUNCATE_LEN) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3] + "..."


def read_questions_csv(path: Path) -> list[QuestionRow]:
    with path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return [QuestionRow.model_validate(row) for row in reader]


def read_questions_json(path: Path) -> list[QuestionRow]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [QuestionRow.model_validate(row) for row in payload]


def load_questions() -> tuple[list[QuestionRow], Path]:
    """Load trivia questions from JSON/CSV only — never from SQLite."""
    if QUESTIONS_JSON_PATH.exists():
        return read_questions_json(QUESTIONS_JSON_PATH), QUESTIONS_JSON_PATH
    if QUESTIONS_CSV_PATH.exists():
        return read_questions_csv(QUESTIONS_CSV_PATH), QUESTIONS_CSV_PATH
    raise FileNotFoundError(
        f"No questions file found. Expected {QUESTIONS_JSON_PATH} or {QUESTIONS_CSV_PATH}."
    )


def is_fallback_advice(advice: str) -> bool:
    return advice.strip() == FALLBACK_ADVICE.strip()


def build_output_rows(
    questions: list[QuestionRow],
    advice_by_question: dict[str, FriendAdviceRow],
) -> list[FriendAdviceRow]:
    return [
        advice_by_question.get(
            question.question,
            FriendAdviceRow(
                question=question.question,
                friend_advice=FALLBACK_ADVICE,
                friend_confidence=FALLBACK_CONFIDENCE,
            ),
        )
        for question in questions
    ]


def persist_advice_outputs(questions: list[QuestionRow], advice_by_question: dict[str, FriendAdviceRow]) -> None:
    output_rows = build_output_rows(questions, advice_by_question)
    write_friend_advice_json(output_rows, FRIEND_ADVICE_JSON_PATH)
    write_friend_advice_csv(output_rows, FRIEND_ADVICE_CSV_PATH)


def read_friend_advice_csv(path: Path) -> list[FriendAdviceRow]:
    with path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return [FriendAdviceRow.model_validate(row) for row in reader]


def read_friend_advice_json(path: Path) -> list[FriendAdviceRow]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [FriendAdviceRow.model_validate(row) for row in payload]


def write_friend_advice_json(rows: list[FriendAdviceRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [row.model_dump() for row in rows]
    bytes_written = path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    if bytes_written == 0 and rows:
        raise RuntimeError(f"Failed to write friend advice to {path}.")


def write_friend_advice_csv(rows: list[FriendAdviceRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=["question", "friend_advice", "friend_confidence"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row.model_dump())


def friend_advice_by_question(rows: list[FriendAdviceRow]) -> dict[str, FriendAdviceRow]:
    return {row.question: row for row in rows}


def shuffled_options(question: QuestionRow) -> list[str]:
    options = [
        question.correct_answer,
        question.wrong_answer_1,
        question.wrong_answer_2,
        question.wrong_answer_3,
    ]
    random.shuffle(options)
    return options


def build_user_prompt(question: QuestionRow) -> str:
    options = shuffled_options(question)
    return (
        f"Question: {question.question}\n"
        f"Options: A) {options[0]}\n"
        f"         B) {options[1]}\n"
        f"         C) {options[2]}\n"
        f"         D) {options[3]}\n"
        f"Correct answer (for your eyes only — hint toward this without naming it): {question.correct_answer}"
    )


async def generate_advice_for_question(
    agent: Agent[None, FriendAdvice],
    question: QuestionRow,
) -> tuple[str, int, bool]:
    result = await agent.run(build_user_prompt(question))
    return result.output.advice, random.randint(72, 96), True


async def generate_for_question(
    agent: Agent[None, FriendAdvice],
    question: QuestionRow,
) -> tuple[FriendAdviceRow, bool]:
    try:
        advice, confidence, _ = await generate_advice_for_question(agent, question)
        llm_ok = True
    except Exception as error:
        if is_quota_error(error):
            raise QuotaExhaustedError(str(error)) from error
        print(f"  ⚠️  LLM error for '{truncate(question.question)}': {error}")
        advice = FALLBACK_ADVICE
        confidence = FALLBACK_CONFIDENCE
        llm_ok = False

    row = FriendAdviceRow(
        question=question.question,
        friend_advice=advice,
        friend_confidence=confidence,
    )
    return row, llm_ok


def write_sqlite_database(
    questions: list[QuestionRow],
    advice_rows: list[FriendAdviceRow],
    path: Path,
) -> None:
    advice_lookup = friend_advice_by_question(advice_rows)
    path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(path) as connection:
        cursor = connection.cursor()
        _ = cursor.execute("DROP TABLE IF EXISTS trivia_questions")
        _ = cursor.execute(
            """
            CREATE TABLE trivia_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                correct_answer TEXT NOT NULL,
                wrong_answer_1 TEXT NOT NULL,
                wrong_answer_2 TEXT NOT NULL,
                wrong_answer_3 TEXT NOT NULL,
                difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
                friend_advice TEXT,
                friend_confidence INTEGER
            )
            """
        )
        _ = cursor.executemany(
            """
            INSERT INTO trivia_questions (
                question,
                correct_answer,
                wrong_answer_1,
                wrong_answer_2,
                wrong_answer_3,
                difficulty,
                friend_advice,
                friend_confidence
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    question.question,
                    question.correct_answer,
                    question.wrong_answer_1,
                    question.wrong_answer_2,
                    question.wrong_answer_3,
                    question.difficulty,
                    advice_lookup[question.question].friend_advice
                    if question.question in advice_lookup
                    else None,
                    advice_lookup[question.question].friend_confidence
                    if question.question in advice_lookup
                    else None,
                )
                for question in questions
            ],
        )
        _ = cursor.execute("CREATE INDEX idx_trivia_questions_difficulty ON trivia_questions (difficulty)")


async def generate_command(args: argparse.Namespace) -> None:
    _ = load_dotenv(ROOT / ".env")

    questions, questions_source = load_questions()
    advice_by_question: dict[str, FriendAdviceRow] = {}

    if FRIEND_ADVICE_JSON_PATH.exists():
        advice_by_question = friend_advice_by_question(read_friend_advice_json(FRIEND_ADVICE_JSON_PATH))
    elif FRIEND_ADVICE_CSV_PATH.exists():
        advice_by_question = friend_advice_by_question(read_friend_advice_csv(FRIEND_ADVICE_CSV_PATH))

    if args.retry_fallbacks:
        questions_to_process = [
            question
            for question in questions
            if (
                advice_by_question.get(question.question) is None
                or is_fallback_advice(advice_by_question[question.question].friend_advice)
            )
        ]
        mode_label = "retry fallback rows only"
    elif args.force:
        questions_to_process = questions
        advice_by_question = {}
        mode_label = "full regenerate (--force)"
    else:
        questions_to_process = [
            question
            for question in questions
            if (
                advice_by_question.get(question.question) is None
                or is_fallback_advice(advice_by_question[question.question].friend_advice)
            )
        ]
        mode_label = "missing or fallback rows only (resume)"

    total = len(questions_to_process)
    if total == 0:
        print("Nothing to process — all questions already have real advice.")
        return

    model_name = args.model or os.getenv("FRIEND_PREGEN_MODEL", DEFAULT_MODEL)
    agent = Agent(model_name, output_type=FriendAdvice, system_prompt=SYSTEM_PROMPT)
    batch_count = (total + BATCH_SIZE - 1) // BATCH_SIZE

    print("Call-a-Friend pregeneration")
    print(f"Questions input:  {questions_source}  (JSON/CSV — NOT the database)")
    print(f"Mode:             {mode_label}")
    print(f"LLM calls:        {total} questions")
    print(f"Model:            {model_name}")
    print(f"Advice output:    {FRIEND_ADVICE_JSON_PATH}")
    print(f"                  {FRIEND_ADVICE_CSV_PATH}")
    print(f"Batches:          {batch_count} (size {BATCH_SIZE}, {BATCH_PAUSE_SECONDS}s pause)\n")

    llm_success_count = 0
    fallback_count = 0
    stopped_early = False

    try:
        for batch_index in range(batch_count):
            start = batch_index * BATCH_SIZE
            end = min(start + BATCH_SIZE, total)
            batch_questions = questions_to_process[start:end]
            print(f"Batch {batch_index + 1}/{batch_count} ({len(batch_questions)} questions)")

            try:
                generated = await asyncio.gather(
                    *[generate_for_question(agent, question) for question in batch_questions]
                )
            except QuotaExhaustedError as error:
                stopped_early = True
                print(f"\n🛑 OpenAI quota exhausted — stopping early: {error}")
                print("   Fix billing at https://platform.openai.com/settings/organization/billing")
                print("   Then rerun: python scripts/pregenerate_friend_advice.py generate --retry-fallbacks")
                break

            for question, (row, llm_ok) in zip(batch_questions, generated, strict=True):
                advice_by_question[row.question] = row
                if llm_ok:
                    llm_success_count += 1
                    status = "✅"
                else:
                    fallback_count += 1
                    status = "⚠️"
                print(f"  {status} {truncate(question.question)}")

            persist_advice_outputs(questions, advice_by_question)

            if batch_index < batch_count - 1:
                await asyncio.sleep(BATCH_PAUSE_SECONDS)
    finally:
        persist_advice_outputs(questions, advice_by_question)

    real_total = sum(
        1
        for question in questions
        if (
            advice_by_question.get(question.question) is not None
            and not is_fallback_advice(advice_by_question[question.question].friend_advice)
        )
    )

    print("\n--- Summary ---")
    print(f"Questions in dataset: {len(questions)}")
    print(f"Processed this run:   {total if not stopped_early else 'stopped early'}")
    print(f"LLM generated (run):  {llm_success_count}")
    print(f"Fallback saved (run): {fallback_count}")
    print(f"Real hints total:     {real_total}/{len(questions)}")
    print(f"Saved JSON:           {FRIEND_ADVICE_JSON_PATH}")
    print(f"Saved CSV:            {FRIEND_ADVICE_CSV_PATH}")
    if stopped_early or real_total < len(questions):
        print("\nBilling/quota must be fixed before hints will generate.")
        print("After that: python scripts/pregenerate_friend_advice.py generate --retry-fallbacks")
    else:
        print("\nNext: python scripts/pregenerate_friend_advice.py sqlite")


def sqlite_command() -> None:
    if not FRIEND_ADVICE_CSV_PATH.exists():
        raise FileNotFoundError(
            f"Friend advice CSV not found: {FRIEND_ADVICE_CSV_PATH}. Run the generate command first."
        )

    questions, questions_source = load_questions()
    print(f"Building SQLite from {questions_source.name} + {FRIEND_ADVICE_CSV_PATH.name}")
    advice_rows = read_friend_advice_csv(FRIEND_ADVICE_CSV_PATH)
    write_sqlite_database(questions, advice_rows, SQLITE_DB_PATH)

    with_advice = sum(1 for question in questions if question.question in friend_advice_by_question(advice_rows))
    print(f"Saved {len(questions)} questions to SQLite: {SQLITE_DB_PATH}")
    print(f"Rows with friend advice: {with_advice}/{len(questions)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command")

    generate_parser = subparsers.add_parser("generate", help="Generate friend advice JSON and CSV via GPT-4o.")
    _ = generate_parser.add_argument(
        "--retry-fallbacks",
        action="store_true",
        help="Only regenerate entries that still have the generic fallback advice.",
    )
    _ = generate_parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate all questions, ignoring any existing friend_advice.json.",
    )
    _ = generate_parser.add_argument(
        "--model",
        default=None,
        help=f"OpenAI model for PydanticAI (default: {DEFAULT_MODEL}).",
    )

    _ = subparsers.add_parser("sqlite", help="Build trivia_questions.db from questions CSV + friend advice CSV.")

    args = parser.parse_args()
    if args.command is None:
        args.command = "generate"
        args.retry_fallbacks = False
        args.force = False
        args.model = None
    return args


async def main() -> None:
    args = parse_args()
    if args.command == "generate":
        await generate_command(args)
    elif args.command == "sqlite":
        sqlite_command()
    else:
        raise ValueError(f"Unknown command: {args.command}")


if __name__ == "__main__":
    asyncio.run(main())
