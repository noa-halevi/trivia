import argparse
import json
import csv
import random
import sqlite3
from pathlib import Path
from typing import Literal, cast

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field

_ = load_dotenv()

SMART_MODEL = "gpt-4.1"
RAW_TARGET = 400
BATCH_SIZE = 25
REVIEW_BATCH_SIZE = 50
MAX_BATCHES = 24
TARGETED_BATCHES = 8
QUESTIONS_PER_TARGET_CATEGORY = 2
HARD_BATCHES = 5
HARD_QUESTIONS_PER_DIFFICULTY = 6
TARGET_CATEGORIES = [
    "People and personas",
    "Movies and TV",
    "Technology",
    "Video games",
    "Food and drink",
    "Sports",
    "Music",
    "Art",
    "Business and brands",
    "Language and words",
    "Math and logical trivia",
]
WEAK_MODELS = ["gpt-4.1-nano", "gpt-4o-mini", "gpt-4.1-mini"]
WEAK_MODEL_BATCH_SIZE = 10
MIN_WEAK_CORRECT_ANSWERS = 1
OPENAI_TIMEOUT_SECONDS = 90.0
OUTPUT_DIR = Path("data")
RAW_JSON_PATH = OUTPUT_DIR / "raw_trivia_questions.json"
RAW_CSV_PATH = OUTPUT_DIR / "raw_trivia_questions.csv"
REVIEWED_JSON_PATH = OUTPUT_DIR / "reviewed_trivia_questions.json"
REVIEWED_CSV_PATH = OUTPUT_DIR / "reviewed_trivia_questions.csv"
REVIEW_REJECTIONS_PATH = OUTPUT_DIR / "review_rejections.json"
TARGETED_RAW_JSON_PATH = OUTPUT_DIR / "targeted_raw_trivia_questions.json"
TARGETED_RAW_CSV_PATH = OUTPUT_DIR / "targeted_raw_trivia_questions.csv"
BALANCED_JSON_PATH = OUTPUT_DIR / "balanced_trivia_questions.json"
BALANCED_CSV_PATH = OUTPUT_DIR / "balanced_trivia_questions.csv"
BALANCE_REJECTIONS_PATH = OUTPUT_DIR / "balance_rejections.json"
FINAL_JSON_PATH = OUTPUT_DIR / "final_trivia_questions.json"
FINAL_CSV_PATH = OUTPUT_DIR / "final_trivia_questions.csv"
WEAK_MODEL_RESULTS_PATH = OUTPUT_DIR / "weak_model_results.json"
WEAK_MODEL_REJECTIONS_PATH = OUTPUT_DIR / "weak_model_rejections.json"
HARD_RAW_JSON_PATH = OUTPUT_DIR / "hard_raw_trivia_questions.json"
HARD_RAW_CSV_PATH = OUTPUT_DIR / "hard_raw_trivia_questions.csv"
HARD_REVIEWED_JSON_PATH = OUTPUT_DIR / "hard_reviewed_trivia_questions.json"
HARD_REVIEWED_CSV_PATH = OUTPUT_DIR / "hard_reviewed_trivia_questions.csv"
HARD_REVIEW_REJECTIONS_PATH = OUTPUT_DIR / "hard_review_rejections.json"
HARD_WEAK_MODEL_RESULTS_PATH = OUTPUT_DIR / "hard_weak_model_results.json"
HARD_WEAK_MODEL_REJECTIONS_PATH = OUTPUT_DIR / "hard_weak_model_rejections.json"
FINAL_WITH_HARD_JSON_PATH = OUTPUT_DIR / "final_with_hard_trivia_questions.json"
FINAL_WITH_HARD_CSV_PATH = OUTPUT_DIR / "final_with_hard_trivia_questions.csv"
FRIEND_ADVICE_JSON_PATH = OUTPUT_DIR / "friend_advice.json"
FRIEND_ADVICE_CSV_PATH = OUTPUT_DIR / "friend_advice.csv"
SQLITE_DB_PATH = OUTPUT_DIR / "trivia_questions.db"

class TriviaQuestion(BaseModel):
    question: str
    correct_answer: str = Field(description="The right answer. MUST be similar length to wrong answers.")
    wrong_answer_1: str = Field(description="Distractor 1. Same length as correct answer.")
    wrong_answer_2: str = Field(description="Distractor 2. Same length as correct answer.")
    wrong_answer_3: str = Field(description="Distractor 3. Same length as correct answer.")
    difficulty: int = Field(description="Difficulty ranking from 1 to 10.")

class TriviaBatch(BaseModel):
    questions: list[TriviaQuestion]

class ReviewDecision(BaseModel):
    question_id: int
    keep: bool
    reason: str

class ReviewResult(BaseModel):
    decisions: list[ReviewDecision]

class WeakModelAnswer(BaseModel):
    question_id: int
    selected_option: Literal["A", "B", "C", "D"]

class WeakModelAnswerBatch(BaseModel):
    answers: list[WeakModelAnswer]

class WeakModelResult(BaseModel):
    question_id: int
    model: str
    selected_option: Literal["A", "B", "C", "D"]
    correct_option: Literal["A", "B", "C", "D"]
    is_correct: bool

class WeakModelRejection(BaseModel):
    question_id: int
    question: str
    correct_answer: str
    correct_model_count: int
    model_results: list[WeakModelResult]

def build_generation_prompt(batch_number: int, existing_questions: list[str]) -> str:
    existing_sample = "\n".join(f"- {question}" for question in existing_questions[-100:])

    return f"""
Generate exactly {BATCH_SIZE} original general-knowledge trivia questions for a real-time multiplayer trivia game.

Rules:
- Return only JSON matching the provided schema.
- Each question must have exactly one objectively correct answer.
- Include three plausible but clearly wrong answers.
- Make the correct answer and wrong answers similar in length and style.
- Do not use "all of the above", "none of the above", joke answers, or subjective/opinion questions.
- Mix categories: history, science, geography, literature, sports, music, movies, art, technology, food, animals, and world culture.
- Mix difficulties from 1 to 10.
- Avoid repeated facts, repeated answers, or reworded versions of earlier questions.
- Keep each question concise and suitable for multiple choice.

This is batch {batch_number}. Avoid questions similar to this recent sample:
{existing_sample if existing_sample else "- No previous questions yet."}
""".strip()

def build_targeted_generation_prompt(batch_number: int, existing_questions: list[str]) -> str:
    existing_sample = "\n".join(f"- {question}" for question in existing_questions[-120:])
    categories = "\n".join(
        f"- {category}: exactly {QUESTIONS_PER_TARGET_CATEGORY} questions"
        for category in TARGET_CATEGORIES
    )
    total_questions = len(TARGET_CATEGORIES) * QUESTIONS_PER_TARGET_CATEGORY

    return f"""
Generate exactly {total_questions} original general-knowledge trivia questions for a real-time multiplayer trivia game.

Category requirements:
{categories}

Rules:
- Return only JSON matching the provided schema.
- Each question must have exactly one objectively correct answer.
- Include three plausible but clearly wrong answers.
- Make the correct answer and wrong answers similar in length and style.
- Do not use "all of the above", "none of the above", joke answers, or subjective/opinion questions.
- Avoid repeated facts, repeated answers, and reworded versions of existing questions.
- Avoid geography-heavy questions unless the category specifically needs a place reference.
- Mix difficulties from 1 to 10, with most questions between 2 and 7.
- Keep each question concise and suitable for multiple choice.

This is targeted category batch {batch_number}/{TARGETED_BATCHES}.
Avoid questions similar to this existing dataset sample:
{existing_sample if existing_sample else "- No previous questions yet."}
""".strip()

def build_hard_generation_prompt(batch_number: int, existing_questions: list[str]) -> str:
    existing_sample = "\n".join(f"- {question}" for question in existing_questions[-150:])
    total_questions = HARD_QUESTIONS_PER_DIFFICULTY * 3

    return f"""
Generate exactly {total_questions} difficult but fair general-knowledge trivia questions.

Difficulty requirements:
- Exactly {HARD_QUESTIONS_PER_DIFFICULTY} questions with difficulty 8.
- Exactly {HARD_QUESTIONS_PER_DIFFICULTY} questions with difficulty 9.
- Exactly {HARD_QUESTIONS_PER_DIFFICULTY} questions with difficulty 10.

Rules:
- Return only JSON matching the provided schema.
- Each question must have exactly one objectively correct answer.
- Include three plausible but clearly wrong answers.
- Make the correct answer and wrong answers similar in length and style.
- Do not use "all of the above", "none of the above", joke answers, or subjective/opinion questions.
- Avoid impossible, ultra-obscure, or badly worded questions. These should be hard but answerable by a smaller LLM from general knowledge.
- Avoid repeated facts, repeated answers, and reworded versions of existing questions.
- Mix categories: science, history, literature, movies/TV, technology, music, art, sports, food/drink, business/brands, language/words, math/logic, mythology, and world culture.
- Avoid geography-heavy questions unless they test a genuinely difficult fact.
- Keep each question concise and suitable for multiple choice.

This is hard-question batch {batch_number}/{HARD_BATCHES}.
Avoid questions similar to this existing dataset sample:
{existing_sample if existing_sample else "- No previous questions yet."}
""".strip()

def build_review_prompt(
    kept_questions: list[tuple[int, TriviaQuestion]],
    candidate_questions: list[tuple[int, TriviaQuestion]],
) -> str:
    kept_text = "\n".join(
        f"{question_id}. {question.question} | Answer: {question.correct_answer}"
        for question_id, question in kept_questions
    )
    candidate_text = "\n".join(
        "\n".join(
            [
                f"ID {question_id}",
                f"Question: {question.question}",
                f"Correct answer: {question.correct_answer}",
                f"Wrong answers: {question.wrong_answer_1}; {question.wrong_answer_2}; {question.wrong_answer_3}",
                f"Difficulty: {question.difficulty}",
            ]
        )
        for question_id, question in candidate_questions
    )

    return f"""
Review these trivia questions for a multiplayer trivia database.

Your job:
- Keep questions that are unique, clear, factual, and suitable for multiple choice.
- Reject questions that repeat the same fact as an already kept question.
- Reject questions that are just a reworded version of another candidate in this batch.
- Reject questions with ambiguous wording, subjective answers, bad distractors, or more than one plausible correct answer.
- Do not reject a question just because it is in the same broad category as another question.
- Return one decision for every candidate ID.

Already kept questions:
{kept_text if kept_text else "None yet."}

Candidate questions:
{candidate_text}
""".strip()

def shuffled_options(question_id: int, question: TriviaQuestion) -> tuple[dict[str, str], Literal["A", "B", "C", "D"]]:
    options = [
        ("correct", question.correct_answer),
        ("wrong", question.wrong_answer_1),
        ("wrong", question.wrong_answer_2),
        ("wrong", question.wrong_answer_3),
    ]
    random.Random(question_id).shuffle(options)

    labeled_options: dict[str, str] = {}
    correct_option: Literal["A", "B", "C", "D"] = "A"
    option_labels: list[Literal["A", "B", "C", "D"]] = ["A", "B", "C", "D"]

    for label, (kind, answer) in zip(option_labels, options):
        labeled_options[label] = answer
        if kind == "correct":
            correct_option = label

    return labeled_options, correct_option

def build_weak_model_solver_prompt(
    candidate_questions: list[tuple[int, TriviaQuestion]],
) -> str:
    question_blocks: list[str] = []

    for question_id, question in candidate_questions:
        options, _ = shuffled_options(question_id, question)
        question_blocks.append(
            "\n".join(
                [
                    f"ID {question_id}",
                    f"Question: {question.question}",
                    f"A. {options['A']}",
                    f"B. {options['B']}",
                    f"C. {options['C']}",
                    f"D. {options['D']}",
                ]
            )
        )

    return f"""
Answer these multiple-choice trivia questions.

Rules:
- Choose exactly one option for every question.
- Return only the requested JSON schema.
- Do not explain your reasoning.
- Do not use web search or external tools.
- If unsure, make your best guess.

Questions:
{chr(10).join(question_blocks)}
""".strip()

def is_valid_question(question: TriviaQuestion) -> bool:
    answers = [
        question.correct_answer,
        question.wrong_answer_1,
        question.wrong_answer_2,
        question.wrong_answer_3,
    ]

    if not question.question.strip():
        return False
    if not 1 <= question.difficulty <= 10:
        return False
    if any(not answer.strip() for answer in answers):
        return False
    if len({answer.casefold().strip() for answer in answers}) != 4:
        return False

    banned_phrases = ("all of the above", "none of the above")
    return not any(phrase in answer.casefold() for phrase in banned_phrases for answer in answers)

def read_questions_csv(path: Path) -> list[TriviaQuestion]:
    with path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return [TriviaQuestion.model_validate(row) for row in reader]

def generate_all_questions() -> list[TriviaQuestion]:
    client = OpenAI(timeout=OPENAI_TIMEOUT_SECONDS)
    questions: list[TriviaQuestion] = []
    seen_question_texts: set[str] = set()

    for batch_index in range(MAX_BATCHES):
        if len(questions) >= RAW_TARGET:
            break

        batch_number = batch_index + 1
        print(f"Running generation batch {batch_number}/{MAX_BATCHES}...")

        completion = client.beta.chat.completions.parse(
            model=SMART_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You generate clean, factual trivia datasets in the exact requested schema.",
                },
                {
                    "role": "user",
                    "content": build_generation_prompt(
                        batch_number=batch_number,
                        existing_questions=[question.question for question in questions],
                    ),
                },
            ],
            response_format=TriviaBatch,
        )

        batch = completion.choices[0].message.parsed
        if batch is None:
            raise RuntimeError(f"{SMART_MODEL} returned no parsed response for batch {batch_number}.")

        accepted_count = 0
        for question in batch.questions:
            normalized_question = question.question.casefold().strip()
            if normalized_question in seen_question_texts:
                continue
            if not is_valid_question(question):
                continue

            questions.append(question)
            seen_question_texts.add(normalized_question)
            accepted_count += 1
            if len(questions) >= RAW_TARGET:
                break

        print(f"Accepted {accepted_count}/{len(batch.questions)} questions. Total: {len(questions)}")

    if len(questions) < RAW_TARGET:
        print(f"Warning: generated only {len(questions)} valid questions after {MAX_BATCHES} batches.")

    return questions

def generate_targeted_questions(existing_questions: list[TriviaQuestion]) -> list[TriviaQuestion]:
    client = OpenAI(timeout=OPENAI_TIMEOUT_SECONDS)
    questions: list[TriviaQuestion] = []
    seen_question_texts = {question.question.casefold().strip() for question in existing_questions}

    for batch_index in range(TARGETED_BATCHES):
        batch_number = batch_index + 1
        print(f"Running targeted category batch {batch_number}/{TARGETED_BATCHES}...")

        completion = client.beta.chat.completions.parse(
            model=SMART_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You generate balanced, factual trivia datasets in the exact requested schema.",
                },
                {
                    "role": "user",
                    "content": build_targeted_generation_prompt(
                        batch_number=batch_number,
                        existing_questions=[
                            question.question for question in [*existing_questions, *questions]
                        ],
                    ),
                },
            ],
            response_format=TriviaBatch,
        )

        batch = completion.choices[0].message.parsed
        if batch is None:
            raise RuntimeError(f"{SMART_MODEL} returned no parsed response for targeted batch {batch_number}.")

        accepted_count = 0
        for question in batch.questions:
            normalized_question = question.question.casefold().strip()
            if normalized_question in seen_question_texts:
                continue
            if not is_valid_question(question):
                continue

            questions.append(question)
            seen_question_texts.add(normalized_question)
            accepted_count += 1

        print(f"Accepted {accepted_count}/{len(batch.questions)} targeted questions. Total targeted: {len(questions)}")

    return questions

def generate_hard_questions(existing_questions: list[TriviaQuestion]) -> list[TriviaQuestion]:
    client = OpenAI(timeout=OPENAI_TIMEOUT_SECONDS)
    questions: list[TriviaQuestion] = []
    seen_question_texts = {question.question.casefold().strip() for question in existing_questions}

    for batch_index in range(HARD_BATCHES):
        batch_number = batch_index + 1
        print(f"Running hard-question batch {batch_number}/{HARD_BATCHES}...", flush=True)

        completion = client.beta.chat.completions.parse(
            model=SMART_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You generate difficult, factual trivia datasets in the exact requested schema.",
                },
                {
                    "role": "user",
                    "content": build_hard_generation_prompt(
                        batch_number=batch_number,
                        existing_questions=[
                            question.question for question in [*existing_questions, *questions]
                        ],
                    ),
                },
            ],
            response_format=TriviaBatch,
        )

        batch = completion.choices[0].message.parsed
        if batch is None:
            raise RuntimeError(f"{SMART_MODEL} returned no parsed response for hard batch {batch_number}.")

        accepted_count = 0
        for question in batch.questions:
            normalized_question = question.question.casefold().strip()
            if normalized_question in seen_question_texts:
                continue
            if not is_valid_question(question):
                continue
            if question.difficulty not in {8, 9, 10}:
                continue

            questions.append(question)
            seen_question_texts.add(normalized_question)
            accepted_count += 1

        print(f"Accepted {accepted_count}/{len(batch.questions)} hard questions. Total hard raw: {len(questions)}", flush=True)

    return questions

def review_and_deduplicate_questions(
    questions: list[TriviaQuestion],
    existing_questions: list[TriviaQuestion] | None = None,
) -> tuple[list[TriviaQuestion], list[ReviewDecision]]:
    client = OpenAI(timeout=OPENAI_TIMEOUT_SECONDS)
    existing_questions = existing_questions or []
    kept_questions = list(enumerate(existing_questions, start=1))
    rejected_decisions: list[ReviewDecision] = []
    seen_question_texts = {question.question.casefold().strip() for question in existing_questions}

    indexed_questions = list(enumerate(questions, start=1))

    for batch_start in range(0, len(indexed_questions), REVIEW_BATCH_SIZE):
        candidate_questions = indexed_questions[batch_start : batch_start + REVIEW_BATCH_SIZE]
        batch_number = (batch_start // REVIEW_BATCH_SIZE) + 1
        total_batches = (len(indexed_questions) + REVIEW_BATCH_SIZE - 1) // REVIEW_BATCH_SIZE
        print(f"Reviewing batch {batch_number}/{total_batches}...")

        locally_valid_candidates: list[tuple[int, TriviaQuestion]] = []
        for question_id, question in candidate_questions:
            normalized_question = question.question.casefold().strip()
            if normalized_question in seen_question_texts or not is_valid_question(question):
                rejected_decisions.append(
                    ReviewDecision(
                        question_id=question_id,
                        keep=False,
                        reason="Rejected by local validation before LLM review.",
                    )
                )
                continue

            locally_valid_candidates.append((question_id, question))
            seen_question_texts.add(normalized_question)

        if not locally_valid_candidates:
            continue

        completion = client.beta.chat.completions.parse(
            model=SMART_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are a strict trivia dataset reviewer. Return only the requested schema.",
                },
                {
                    "role": "user",
                    "content": build_review_prompt(
                        kept_questions=kept_questions,
                        candidate_questions=locally_valid_candidates,
                    ),
                },
            ],
            response_format=ReviewResult,
        )

        review_result = completion.choices[0].message.parsed
        if review_result is None:
            raise RuntimeError(f"{SMART_MODEL} returned no parsed review for batch {batch_number}.")

        candidates_by_id = dict(locally_valid_candidates)
        reviewed_ids: set[int] = set()
        kept_before_batch = len(kept_questions)

        for decision in review_result.decisions:
            question = candidates_by_id.get(decision.question_id)
            if question is None:
                continue

            reviewed_ids.add(decision.question_id)
            if decision.keep:
                kept_questions.append((decision.question_id, question))
            else:
                rejected_decisions.append(decision)

        for question_id, question in locally_valid_candidates:
            if question_id in reviewed_ids:
                continue

            rejected_decisions.append(
                ReviewDecision(
                    question_id=question_id,
                    keep=False,
                    reason="The reviewer did not return a decision for this question.",
                )
            )

        kept_in_batch = len(kept_questions) - kept_before_batch
        print(f"Kept {kept_in_batch}/{len(locally_valid_candidates)} reviewed questions. Total kept: {len(kept_questions)}")

    return [question for _, question in kept_questions], rejected_decisions

def solve_questions_with_weak_model(
    client: OpenAI,
    model: str,
    indexed_questions: list[tuple[int, TriviaQuestion]],
) -> list[WeakModelResult]:
    results: list[WeakModelResult] = []

    for batch_start in range(0, len(indexed_questions), WEAK_MODEL_BATCH_SIZE):
        candidate_questions = indexed_questions[batch_start : batch_start + WEAK_MODEL_BATCH_SIZE]
        batch_number = (batch_start // WEAK_MODEL_BATCH_SIZE) + 1
        total_batches = (len(indexed_questions) + WEAK_MODEL_BATCH_SIZE - 1) // WEAK_MODEL_BATCH_SIZE
        print(f"Asking {model} batch {batch_number}/{total_batches}...", flush=True)

        completion = client.beta.chat.completions.parse(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You answer multiple-choice trivia questions. Return only the requested schema.",
                },
                {
                    "role": "user",
                    "content": build_weak_model_solver_prompt(candidate_questions),
                },
            ],
            response_format=WeakModelAnswerBatch,
        )

        answer_batch = completion.choices[0].message.parsed
        if answer_batch is None:
            raise RuntimeError(f"{model} returned no parsed answer batch {batch_number}.")

        questions_by_id = dict(candidate_questions)
        answered_ids: set[int] = set()

        for answer in answer_batch.answers:
            question = questions_by_id.get(answer.question_id)
            if question is None:
                continue

            _, correct_option = shuffled_options(answer.question_id, question)
            answered_ids.add(answer.question_id)
            results.append(
                WeakModelResult(
                    question_id=answer.question_id,
                    model=model,
                    selected_option=answer.selected_option,
                    correct_option=correct_option,
                    is_correct=answer.selected_option == correct_option,
                )
            )

        for question_id, question in candidate_questions:
            if question_id in answered_ids:
                continue

            _, correct_option = shuffled_options(question_id, question)
            results.append(
                WeakModelResult(
                    question_id=question_id,
                    model=model,
                    selected_option="A",
                    correct_option=correct_option,
                    is_correct=False,
                )
            )

    return results

def filter_questions_with_weak_models(
    questions: list[TriviaQuestion],
) -> tuple[list[TriviaQuestion], list[WeakModelResult], list[WeakModelRejection]]:
    client = OpenAI(timeout=OPENAI_TIMEOUT_SECONDS)
    indexed_questions = list(enumerate(questions, start=1))
    all_results: list[WeakModelResult] = []

    for model in WEAK_MODELS:
        print(f"Starting weak-model pass: {model}", flush=True)
        all_results.extend(
            solve_questions_with_weak_model(
                client=client,
                model=model,
                indexed_questions=indexed_questions,
            )
        )

    results_by_question_id: dict[int, list[WeakModelResult]] = {
        question_id: [] for question_id, _ in indexed_questions
    }
    for result in all_results:
        results_by_question_id[result.question_id].append(result)

    kept_questions: list[TriviaQuestion] = []
    rejections: list[WeakModelRejection] = []

    for question_id, question in indexed_questions:
        question_results = results_by_question_id[question_id]
        correct_count = sum(1 for result in question_results if result.is_correct)

        if correct_count >= MIN_WEAK_CORRECT_ANSWERS:
            kept_questions.append(question)
            continue

        rejections.append(
            WeakModelRejection(
                question_id=question_id,
                question=question.question,
                correct_answer=question.correct_answer,
                correct_model_count=correct_count,
                model_results=question_results,
            )
        )

    return kept_questions, all_results, rejections

def write_questions_json(questions: list[TriviaQuestion], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [question.model_dump() for question in questions]
    bytes_written = path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    if bytes_written == 0 and questions:
        raise RuntimeError(f"Failed to write questions to {path}.")

def write_questions_csv(questions: list[TriviaQuestion], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=[
                "question",
                "correct_answer",
                "wrong_answer_1",
                "wrong_answer_2",
                "wrong_answer_3",
                "difficulty",
            ],
        )
        writer.writeheader()
        for question in questions:
            writer.writerow(question.model_dump())

def write_rejections_json(rejections: list[ReviewDecision], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [rejection.model_dump() for rejection in rejections]
    bytes_written = path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    if bytes_written == 0 and rejections:
        raise RuntimeError(f"Failed to write review rejections to {path}.")

def write_json_payload(payload: object, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bytes_written = path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    if bytes_written == 0 and payload:
        raise RuntimeError(f"Failed to write JSON payload to {path}.")

def read_friend_advice_csv(path: Path) -> dict[str, tuple[str, int]]:
    if not path.exists():
        return {}
    with path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return {
            str(row["question"]): (str(row["friend_advice"]), int(str(row["friend_confidence"])))
            for row in reader
        }


def write_sqlite_database(questions: list[TriviaQuestion], path: Path) -> None:
    friend_advice_by_question = read_friend_advice_csv(FRIEND_ADVICE_CSV_PATH)
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
                    friend_advice_by_question.get(question.question, (None, None))[0],
                    friend_advice_by_question.get(question.question, (None, None))[1],
                )
                for question in questions
            ],
        )
        _ = cursor.execute("CREATE INDEX idx_trivia_questions_difficulty ON trivia_questions (difficulty)")

def generate_command() -> None:
    questions = generate_all_questions()
    write_questions_json(questions, RAW_JSON_PATH)
    write_questions_csv(questions, RAW_CSV_PATH)
    print(f"Saved {len(questions)} raw questions to {RAW_JSON_PATH} and {RAW_CSV_PATH}.")

def review_command() -> None:
    questions = read_questions_csv(RAW_CSV_PATH)
    reviewed_questions, rejections = review_and_deduplicate_questions(questions)
    write_questions_json(reviewed_questions, REVIEWED_JSON_PATH)
    write_questions_csv(reviewed_questions, REVIEWED_CSV_PATH)
    write_rejections_json(rejections, REVIEW_REJECTIONS_PATH)
    print(f"Saved {len(reviewed_questions)} reviewed questions to {REVIEWED_JSON_PATH} and {REVIEWED_CSV_PATH}.")
    print(f"Saved {len(rejections)} rejected-question notes to {REVIEW_REJECTIONS_PATH}.")

def balance_command() -> None:
    existing_questions = read_questions_csv(REVIEWED_CSV_PATH)
    targeted_questions = generate_targeted_questions(existing_questions)
    write_questions_json(targeted_questions, TARGETED_RAW_JSON_PATH)
    write_questions_csv(targeted_questions, TARGETED_RAW_CSV_PATH)

    balanced_questions, rejections = review_and_deduplicate_questions(
        questions=targeted_questions,
        existing_questions=existing_questions,
    )
    write_questions_json(balanced_questions, BALANCED_JSON_PATH)
    write_questions_csv(balanced_questions, BALANCED_CSV_PATH)
    write_rejections_json(rejections, BALANCE_REJECTIONS_PATH)

    added_count = len(balanced_questions) - len(existing_questions)
    print(f"Saved {len(targeted_questions)} targeted raw questions to {TARGETED_RAW_JSON_PATH} and {TARGETED_RAW_CSV_PATH}.")
    print(f"Added {added_count} reviewed targeted questions.")
    print(f"Saved {len(balanced_questions)} balanced questions to {BALANCED_JSON_PATH} and {BALANCED_CSV_PATH}.")
    print(f"Saved {len(rejections)} balance rejection notes to {BALANCE_REJECTIONS_PATH}.")

def weak_filter_command() -> None:
    questions = read_questions_csv(BALANCED_CSV_PATH)
    final_questions, model_results, rejections = filter_questions_with_weak_models(questions)

    write_questions_json(final_questions, FINAL_JSON_PATH)
    write_questions_csv(final_questions, FINAL_CSV_PATH)
    write_json_payload([result.model_dump() for result in model_results], WEAK_MODEL_RESULTS_PATH)
    write_json_payload([rejection.model_dump() for rejection in rejections], WEAK_MODEL_REJECTIONS_PATH)

    print(f"Weak models used: {', '.join(WEAK_MODELS)}")
    print(f"Kept {len(final_questions)}/{len(questions)} questions.")
    print(f"Removed {len(rejections)} questions that no weak model answered correctly.")
    print(f"Saved final questions to {FINAL_JSON_PATH} and {FINAL_CSV_PATH}.")
    print(f"Saved weak-model answer logs to {WEAK_MODEL_RESULTS_PATH}.")
    print(f"Saved weak-model rejection notes to {WEAK_MODEL_REJECTIONS_PATH}.")

def add_hard_command() -> None:
    existing_questions = read_questions_csv(FINAL_CSV_PATH)
    hard_raw_questions = generate_hard_questions(existing_questions)
    write_questions_json(hard_raw_questions, HARD_RAW_JSON_PATH)
    write_questions_csv(hard_raw_questions, HARD_RAW_CSV_PATH)

    reviewed_with_existing, review_rejections = review_and_deduplicate_questions(
        questions=hard_raw_questions,
        existing_questions=existing_questions,
    )
    hard_reviewed_questions = reviewed_with_existing[len(existing_questions) :]
    write_questions_json(hard_reviewed_questions, HARD_REVIEWED_JSON_PATH)
    write_questions_csv(hard_reviewed_questions, HARD_REVIEWED_CSV_PATH)
    write_rejections_json(review_rejections, HARD_REVIEW_REJECTIONS_PATH)

    hard_final_questions, weak_results, weak_rejections = filter_questions_with_weak_models(hard_reviewed_questions)
    final_with_hard_questions = [*existing_questions, *hard_final_questions]

    write_questions_json(final_with_hard_questions, FINAL_WITH_HARD_JSON_PATH)
    write_questions_csv(final_with_hard_questions, FINAL_WITH_HARD_CSV_PATH)
    write_json_payload([result.model_dump() for result in weak_results], HARD_WEAK_MODEL_RESULTS_PATH)
    write_json_payload([rejection.model_dump() for rejection in weak_rejections], HARD_WEAK_MODEL_REJECTIONS_PATH)

    print(f"Generated {len(hard_raw_questions)} hard raw questions.")
    print(f"Kept {len(hard_reviewed_questions)} hard questions after smart review/dedupe.")
    print(f"Kept {len(hard_final_questions)} hard questions after weak-model filtering.")
    print(f"Saved combined final dataset with {len(final_with_hard_questions)} questions to {FINAL_WITH_HARD_CSV_PATH}.")

def sqlite_command() -> None:
    questions = read_questions_csv(FINAL_WITH_HARD_CSV_PATH)
    write_sqlite_database(questions, SQLITE_DB_PATH)
    advice_count = len(read_friend_advice_csv(FRIEND_ADVICE_CSV_PATH))
    print(f"Saved {len(questions)} questions to SQLite database: {SQLITE_DB_PATH}")
    if advice_count:
        print(f"Merged {advice_count} friend advice rows from {FRIEND_ADVICE_CSV_PATH}.")
    else:
        print(f"No friend advice CSV at {FRIEND_ADVICE_CSV_PATH}; friend_advice columns left empty.")

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and review trivia questions.")
    command_argument = parser.add_argument(
        "command",
        choices=["generate", "review", "balance", "weak-filter", "add-hard", "sqlite"],
        nargs="?",
        default="generate",
        help="Use 'generate', 'review', 'balance', 'weak-filter', 'add-hard', or 'sqlite'.",
    )
    del command_argument
    args = parser.parse_args()
    command = cast(Literal["generate", "review", "balance", "weak-filter", "add-hard", "sqlite"], args.command)

    if command == "generate":
        generate_command()
    elif command == "review":
        review_command()
    elif command == "balance":
        balance_command()
    elif command == "weak-filter":
        weak_filter_command()
    elif command == "add-hard":
        add_hard_command()
    elif command == "sqlite":
        sqlite_command()

if __name__ == "__main__":
    main()