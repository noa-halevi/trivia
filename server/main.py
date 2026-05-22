import asyncio
import random
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, TypedDict, cast

import socketio
from aiohttp import web

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server.bots import BOT_NAMES, run_bot
from server.config import LOBBY_WAIT, PORT
from server.config import QUESTION_TIME, QUESTIONS_PER_GAME
from server.db import DB_PATH, QuestionRow, get_player_stats, get_questions_by_difficulty, init_db, save_game_log
from server.friend import get_friend_advice


HelpType = Literal["fifty_fifty", "call_a_friend", "double_score"]


class HelpUsage(TypedDict):
    fifty_fifty: bool
    call_a_friend: bool
    double_score: bool


class Player(TypedDict):
    sid: str
    name: str
    is_bot: bool
    score: int
    questions_correct: int
    helps_used: HelpUsage
    double_score_active: bool


class Lobby(TypedDict):
    players: list[Player]
    timer_task: asyncio.Task[None] | None


class Room(TypedDict):
    id: str
    players: list[Player]
    questions: list["TriviaQuestion"]
    current_q_index: int
    current_difficulty: int
    answers_this_round: dict[str, "AnswerRecord"]
    question_start_time: float
    active: bool


class TriviaQuestion(TypedDict):
    id: int
    question: str
    correct_answer: str
    wrong_answer_1: str
    wrong_answer_2: str
    wrong_answer_3: str
    difficulty: int


class AnswerRecord(TypedDict):
    answer: str
    time_taken: float


sio = socketio.AsyncServer(async_mode="aiohttp", cors_allowed_origins="*")
app = web.Application()
sio.attach(app)  # pyright: ignore[reportUnknownMemberType]

lobbies: Lobby = {
    "players": [],
    "timer_task": None,
}
rooms: dict[str, Room] = {}
lobby_seconds_left = LOBBY_WAIT

def lobby_player_names() -> list[str]:
    return [player["name"] for player in lobbies["players"]]


async def emit_lobby_status(seconds_left: int) -> None:
    payload = {
        "players": lobby_player_names(),
        "seconds_left": seconds_left,
    }

    for player in lobbies["players"]:
        if not player["is_bot"]:
            await sio.emit("lobby_status", payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]


def reset_lobby(cancel_timer: bool = True) -> None:
    timer_task = lobbies["timer_task"]
    current_task = asyncio.current_task()

    if cancel_timer and timer_task is not None and timer_task is not current_task and not timer_task.done():
        _ = timer_task.cancel()

    lobbies["players"] = []
    lobbies["timer_task"] = None


def make_bot() -> Player:
    return {
        "sid": f"bot_{uuid.uuid4().hex}",
        "name": random.choice(BOT_NAMES),
        "is_bot": True,
        "score": 0,
        "questions_correct": 0,
        "helps_used": new_help_usage(),
        "double_score_active": False,
    }


def new_help_usage() -> HelpUsage:
    return {
        "fifty_fifty": False,
        "call_a_friend": False,
        "double_score": False,
    }


async def load_questions(room: Room) -> None:
    rows = await get_questions_by_difficulty(room["current_difficulty"], QUESTIONS_PER_GAME)
    room["questions"] = [question_from_row(row) for row in rows]


def question_from_row(row: QuestionRow) -> TriviaQuestion:
    return {
        "id": int(row["id"]),
        "question": str(row["question"]),
        "correct_answer": str(row["correct_answer"]),
        "wrong_answer_1": str(row["wrong_answer_1"]),
        "wrong_answer_2": str(row["wrong_answer_2"]),
        "wrong_answer_3": str(row["wrong_answer_3"]),
        "difficulty": int(row["difficulty"]),
    }


def question_options(question: TriviaQuestion) -> list[str]:
    options = [
        question["correct_answer"],
        question["wrong_answer_1"],
        question["wrong_answer_2"],
        question["wrong_answer_3"],
    ]
    random.shuffle(options)
    return options


def player_scores(room: Room) -> list[dict[str, int | str]]:
    return [
        {
            "name": player["name"],
            "score": player["score"],
        }
        for player in room["players"]
    ]


async def emit_to_humans(room: Room, event: str, payload: object) -> None:
    for player in room["players"]:
        if not player["is_bot"]:
            await sio.emit(event, payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]


async def lobby_countdown() -> None:
    global lobby_seconds_left

    for seconds_left in range(LOBBY_WAIT, 0, -1):
        lobby_seconds_left = seconds_left
        await emit_lobby_status(seconds_left)
        await asyncio.sleep(1)

    lobby_seconds_left = 0
    await start_game()


async def start_game() -> None:
    players = list(lobbies["players"])
    if not players:
        reset_lobby(cancel_timer=False)
        return

    human_players = [player for player in players if not player["is_bot"]]
    if len(human_players) == 1:
        bot_count = random.randint(1, 3)
        players.extend(make_bot() for _ in range(bot_count))

    room_id = str(uuid.uuid4())
    room: Room = {
        "id": room_id,
        "players": players,
        "questions": [],
        "current_q_index": 0,
        "current_difficulty": 5,
        "answers_this_round": {},
        "question_start_time": 0.0,
        "active": True,
    }
    rooms[room_id] = room

    payload = {
        "room_id": room_id,
        "players": [player["name"] for player in players],
    }
    for player in human_players:
        await sio.emit("game_starting", payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]
        await sio.enter_room(player["sid"], room_id)  # pyright: ignore[reportUnknownMemberType]

    reset_lobby(cancel_timer=False)
    await load_questions(room)
    _ = asyncio.create_task(run_game(room))


async def run_game(room: Room) -> None:
    for question_index in range(min(QUESTIONS_PER_GAME, len(room["questions"]))):
        if not room["active"]:
            return

        room["current_q_index"] = question_index
        room["answers_this_round"] = {}
        room["question_start_time"] = time.time()

        question = room["questions"][question_index]
        await emit_to_humans(
            room,
            "question",
            {
                "question_id": question["id"],
                "question": question["question"],
                "options": question_options(question),
                "difficulty": question["difficulty"],
                "question_number": question_index + 1,
                "time_limit": QUESTION_TIME,
            },
        )
        for player in room["players"]:
            if player["is_bot"]:
                _ = asyncio.create_task(run_bot(player, question, room, sio))

        await asyncio.sleep(QUESTION_TIME)
        grade_round(room, question)
        await adapt_difficulty(room)
        await emit_to_humans(
            room,
            "round_result",
            {
                "correct_answer": question["correct_answer"],
                "scores": player_scores(room),
            },
        )

    await end_game(room)


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def answer(sid: str, data: dict[str, object]) -> None:
    room = find_active_room_for_sid(sid)
    if room is None:
        return

    if sid in room["answers_this_round"]:
        return

    time_taken = time.time() - room["question_start_time"]
    if time_taken < 0 or time_taken > QUESTION_TIME:
        return

    question = current_question(room)
    if question is None:
        return

    question_id = data.get("question_id")
    if question_id is not None and int(str(question_id)) != question["id"]:
        return

    answer_value = data.get("answer")
    if answer_value is None:
        return

    room["answers_this_round"][sid] = {
        "answer": str(answer_value),
        "time_taken": time_taken,
    }


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def use_help(sid: str, data: dict[str, object]) -> None:
    room = find_active_room_for_sid(sid)
    if room is None:
        return

    player = find_player_in_room(room, sid)
    if player is None or player["is_bot"]:
        return

    question = current_question(room)
    if question is None:
        return

    raw_help_type = data.get("type")
    if raw_help_type not in {"fifty_fifty", "call_a_friend", "double_score"}:
        return
    help_type = cast(HelpType, raw_help_type)

    if player["helps_used"][help_type]:
        await sio.emit("help_error", {"type": help_type, "message": "Help already used."}, to=sid)  # pyright: ignore[reportUnknownMemberType]
        return

    player["helps_used"][help_type] = True

    if help_type == "fifty_fifty":
        remaining_options = fifty_fifty_options(question)
        await sio.emit("fifty_fifty_result", {"remaining_options": remaining_options}, to=sid)  # pyright: ignore[reportUnknownMemberType]
        return

    if help_type == "call_a_friend":
        advice = await get_friend_advice(dict(question))
        await sio.emit("friend_advice", {"advice": advice}, to=sid)  # pyright: ignore[reportUnknownMemberType]
        return

    player["double_score_active"] = True
    await sio.emit("double_score_active", {"active": True}, to=sid)  # pyright: ignore[reportUnknownMemberType]


def find_player_in_room(room: Room, sid: str) -> Player | None:
    for player in room["players"]:
        if player["sid"] == sid:
            return player
    return None


def fifty_fifty_options(question: TriviaQuestion) -> list[str]:
    wrong_answers = [
        question["wrong_answer_1"],
        question["wrong_answer_2"],
        question["wrong_answer_3"],
    ]
    remaining_options = [question["correct_answer"], random.choice(wrong_answers)]
    random.shuffle(remaining_options)
    return remaining_options


def find_active_room_for_sid(sid: str) -> Room | None:
    for room in rooms.values():
        if not room["active"]:
            continue
        if any(player["sid"] == sid for player in room["players"]):
            return room
    return None


def current_question(room: Room) -> TriviaQuestion | None:
    index = room["current_q_index"]
    if index < 0 or index >= len(room["questions"]):
        return None
    return room["questions"][index]


def grade_round(room: Room, question: TriviaQuestion) -> None:
    for player in room["players"]:
        answer_record = room["answers_this_round"].get(player["sid"])
        if answer_record is None:
            continue

        if not answers_match(answer_record["answer"], question["correct_answer"]):
            continue

        time_taken = max(1.0, min(QUESTION_TIME, answer_record["time_taken"]))
        points = max(100, 1000 - int((time_taken - 1) * (900 / 14)))
        if player["double_score_active"]:
            points *= 2
            player["double_score_active"] = False

        player["score"] += points
        player["questions_correct"] += 1


def answers_match(answer: str, correct_answer: str) -> bool:
    return answer.strip().casefold() == correct_answer.strip().casefold()


def count_helps_used(player: Player) -> int:
    return sum(1 for was_used in player["helps_used"].values() if was_used)


def find_room_by_sid(sid: str) -> Room | None:
    for room in rooms.values():
        if any(player["sid"] == sid for player in room["players"]):
            return room
    return None


async def adapt_difficulty(room: Room) -> None:
    human_players = [player for player in room["players"] if not player["is_bot"]]
    if not human_players:
        return

    correct_human_count = 0
    current = current_question(room)
    if current is None:
        return

    for player in human_players:
        answer_record = room["answers_this_round"].get(player["sid"])
        if answer_record is not None and answers_match(answer_record["answer"], current["correct_answer"]):
            correct_human_count += 1

    if correct_human_count > len(human_players) / 2:
        room["current_difficulty"] = min(10, room["current_difficulty"] + 1)
    elif correct_human_count < len(human_players) / 2:
        room["current_difficulty"] = max(1, room["current_difficulty"] - 1)

    next_index = room["current_q_index"] + 1
    if next_index >= QUESTIONS_PER_GAME:
        return

    rows = await get_questions_by_difficulty(room["current_difficulty"], 1)
    if not rows:
        return

    next_question = question_from_row(rows[0])
    if next_index < len(room["questions"]):
        room["questions"][next_index] = next_question
    else:
        room["questions"].append(next_question)


async def end_game(room: Room) -> None:
    room["active"] = False
    leaderboard_players = sorted(room["players"], key=lambda player: player["score"], reverse=True)
    leaderboard = [
        {
            "name": player["name"],
            "score": player["score"],
            "questions_correct": player["questions_correct"],
        }
        for player in leaderboard_players
    ]

    await emit_to_humans(room, "game_over", {"leaderboard": leaderboard})

    for player in leaderboard_players:
        if player["is_bot"]:
            continue
        await save_game_log(player, room["id"])

    del rooms[room["id"]]


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def join_lobby(sid: str, data: dict[str, str]) -> None:
    player_name = data.get("player_name", "").strip()
    if not player_name:
        player_name = "Anonymous"

    lobbies["players"] = [player for player in lobbies["players"] if player["sid"] != sid]
    was_empty = len(lobbies["players"]) == 0
    lobbies["players"].append(
        {
            "sid": sid,
            "name": player_name,
            "is_bot": False,
            "score": 0,
            "questions_correct": 0,
            "helps_used": new_help_usage(),
            "double_score_active": False,
        }
    )

    if was_empty:
        lobbies["timer_task"] = asyncio.create_task(lobby_countdown())
    else:
        await emit_lobby_status(lobby_seconds_left)


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def disconnect(sid: str) -> None:
    lobbies["players"] = [player for player in lobbies["players"] if player["sid"] != sid]

    if not lobbies["players"]:
        reset_lobby()


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def chat_message(sid: str, data: dict[str, object]) -> None:
    room = find_room_by_sid(sid)
    if room is None:
        return

    player = find_player_in_room(room, sid)
    if player is None:
        return

    text = str(data.get("text", "")).strip()
    if not text:
        return

    await sio.emit(  # pyright: ignore[reportUnknownMemberType]
        "chat_message",
        {
            "player_name": player["name"],
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        to=room["id"],
    )


async def stats_handler(_: web.Request) -> web.Response:
    return web.json_response(await get_player_stats())


async def on_startup(_: web.Application) -> None:
    print(f"Initializing database: {DB_PATH}")
    await init_db()
    print("Database initialized")
    print("Server running")


app.on_startup.append(on_startup)
_ = app.router.add_get("/stats", stats_handler)


if __name__ == "__main__":
    web.run_app(app, port=PORT)
