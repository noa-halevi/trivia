import asyncio
import string
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

from server.bot_player import BotDefinition, pick_pending_bots
from server.bots import run_bot
from server.config import LOBBY_WAIT, PORT
from server.config import QUESTIONS_PER_GAME
from server.db import (
    DB_PATH,
    QuestionRow,
    get_player_stats,
    get_pregenerated_friend_advice,
    get_questions_by_difficulty,
    init_db,
    save_game_log,
)
from server.friend import get_friend_advice


HelpType = Literal["fifty_fifty", "call_a_friend", "double_score"]


class HelpUsage(TypedDict):
    fifty_fifty: bool
    call_a_friend: bool
    double_score: bool


class Player(TypedDict):
    sid: str
    name: str
    avatar: str
    is_bot: bool
    score: int
    questions_correct: int
    total_answer_time: float
    answered_questions: int
    answer_times: list[float]
    current_streak: int
    best_streak: int
    best_round_points: int
    helps_used: HelpUsage
    double_score_active: bool


class BotJoinSchedule(TypedDict):
    bot_def: BotDefinition
    delay_seconds: float


class Lobby(TypedDict):
    players: list[Player]
    timer_task: asyncio.Task[None] | None
    pending_bots: list[BotDefinition]
    bot_join_tasks: list[asyncio.Task[None]]
    game_starting: bool
    countdown_started: bool


RoomType = Literal["public", "private"]
PrivateRoomStatus = Literal["waiting", "in_game", "finished"]


class PrivateRoom(TypedDict):
    code: str
    host_sid: str
    players: list[Player]
    status: PrivateRoomStatus
    started: bool
    room_id: str | None
    countdown_started: bool


class Room(TypedDict):
    id: str
    room_type: RoomType
    room_code: str | None
    players: list[Player]
    questions: list["TriviaQuestion"]
    used_question_ids: set[int]
    current_q_index: int
    current_difficulty: int
    pending_answers_this_round: dict[str, "PendingAnswerRecord"]
    answers_this_round: dict[str, "AnswerRecord"]
    question_start_time: float
    question_sent_at: dict[str, float]
    current_question_options: list[str]
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
    submitted_at: float


class PendingAnswerRecord(TypedDict):
    answer: str


sio = socketio.AsyncServer(async_mode="aiohttp", cors_allowed_origins="*")
app = web.Application()
sio.attach(app)  # pyright: ignore[reportUnknownMemberType]

lobbies: Lobby = {
    "players": [],
    "timer_task": None,
    "pending_bots": [],
    "bot_join_tasks": [],
    "game_starting": False,
    "countdown_started": False,
}
rooms: dict[str, Room] = {}
private_rooms: dict[str, PrivateRoom] = {}
lobby_seconds_left = LOBBY_WAIT
ROUND_RESULT_PAUSE_SECONDS = 3.0
GAME_COUNTDOWN_SECONDS = 3.8


MAX_LOBBY_PLAYERS = 4
MAX_LOBBY_BOTS = 3
PUBLIC_LOBBY_ROOM = "public_lobby"
LOBBY_READY_PAUSE_SECONDS = 1.5


def lobby_player_names() -> list[str]:
    return [player["name"] for player in lobbies["players"]]


def lobby_human_players() -> list[Player]:
    return [player for player in lobbies["players"] if not player["is_bot"]]


def lobby_bot_count() -> int:
    return len([player for player in lobbies["players"] if player["is_bot"]])


def lobby_human_avatars() -> set[str]:
    return {player["avatar"] for player in lobby_human_players()}


def public_player_joined_payload(player: Player) -> dict[str, object]:
    player_data = {
        "nickname": player["name"],
        "avatar": player["avatar"],
        "is_bot": player["is_bot"],
        "score": player["score"],
    }
    return {
        "player": player_data,
        "nickname": player["name"],
        "name": player["name"],
        "avatar": player["avatar"],
        "is_bot": player["is_bot"],
        "score": player["score"],
    }


def lobby_status_players(for_sid: str) -> list[dict[str, object]]:
    return [
        {
            "name": player["name"],
            "nickname": player["name"],
            "avatar": player["avatar"],
            "is_bot": player["is_bot"],
            "is_pending": False,
            "is_you": player["sid"] == for_sid,
        }
        for player in lobbies["players"]
    ]


def build_bot_join_schedule(human_count: int, bots_already_in_lobby: int) -> list[BotJoinSchedule]:
    slots_left = max(0, MAX_LOBBY_PLAYERS - human_count - bots_already_in_lobby)
    if slots_left <= 0:
        return []

    if human_count == 1:
        target_bots = random.randint(2, 3)
        delays = sorted(random.uniform(3, 19) for _ in range(target_bots))
    elif human_count == 2:
        target_bots = 2 if random.random() < 0.5 else 1
        delays = [random.uniform(3, 10)]
        if target_bots >= 2:
            delays.append(random.uniform(10, 18))
    elif human_count == 3:
        target_bots = 1
        delays = [random.uniform(3, 10)]
    else:
        return []

    target_bots = min(target_bots, MAX_LOBBY_BOTS, slots_left)
    delays = delays[:target_bots]
    bot_defs = pick_pending_bots(len(delays), excluded_avatars=lobby_human_avatars())
    return [
        {"bot_def": bot_defs[index], "delay_seconds": delays[index]}
        for index in range(len(delays))
    ]


def cancel_bot_join_tasks() -> None:
    for task in lobbies["bot_join_tasks"]:
        if not task.done():
            task.cancel()
    lobbies["bot_join_tasks"] = []


def reschedule_public_lobby_bots() -> None:
    cancel_bot_join_tasks()
    lobbies["pending_bots"] = []

    human_count = len(lobby_human_players())
    if human_count == 0 or human_count >= MAX_LOBBY_PLAYERS:
        return

    bots_in_lobby = lobby_bot_count()
    schedule = build_bot_join_schedule(human_count, bots_in_lobby)
    lobbies["pending_bots"] = [entry["bot_def"] for entry in schedule]

    for entry in schedule:
        task = asyncio.create_task(schedule_bot_join(entry["bot_def"], entry["delay_seconds"]))
        lobbies["bot_join_tasks"].append(task)


async def schedule_bot_join(bot_def: BotDefinition, delay_seconds: float) -> None:
    try:
        await asyncio.sleep(delay_seconds)
        if lobbies["game_starting"]:
            return
        await join_bot_to_lobby(bot_def)
    except asyncio.CancelledError:
        return


async def join_bot_to_lobby(bot_def: BotDefinition) -> None:
    if lobbies["game_starting"]:
        return

    human_count = len(lobby_human_players())
    if human_count == 0 or human_count >= MAX_LOBBY_PLAYERS:
        return

    if len(lobbies["players"]) >= MAX_LOBBY_PLAYERS:
        return

    if lobby_bot_count() >= MAX_LOBBY_BOTS:
        return

    if any(player["name"] == bot_def["name"] for player in lobbies["players"]):
        return

    bot_player = make_bot(bot_def)
    lobbies["players"].append(bot_player)

    payload = public_player_joined_payload(bot_player)
    await sio.emit("player_joined", payload, room=PUBLIC_LOBBY_ROOM)  # pyright: ignore[reportUnknownMemberType]

    await maybe_start_lobby_game_early()


async def maybe_start_lobby_game_early() -> None:
    if lobbies["game_starting"]:
        return

    if len(lobbies["players"]) < 2:
        return

    pending_tasks = [task for task in lobbies["bot_join_tasks"] if not task.done()]
    if pending_tasks:
        return

    await trigger_public_lobby_game_start()


def cancel_lobby_timer_task() -> None:
    timer_task = lobbies["timer_task"]
    current_task = asyncio.current_task()
    if timer_task is not None and timer_task is not current_task and not timer_task.done():
        timer_task.cancel()
    lobbies["timer_task"] = None


async def emit_game_countdown_start(*, room: str | None = None, to: str | None = None) -> bool:
    if lobbies["countdown_started"]:
        return False

    lobbies["countdown_started"] = True
    if room is not None:
        await sio.emit("game_countdown_start", {}, room=room)  # pyright: ignore[reportUnknownMemberType]
    elif to is not None:
        await sio.emit("game_countdown_start", {}, to=to)  # pyright: ignore[reportUnknownMemberType]
    return True


async def trigger_public_lobby_game_start() -> None:
    if lobbies["game_starting"] or lobbies["countdown_started"]:
        return

    if len(lobbies["players"]) < 2:
        return

    lobbies["game_starting"] = True
    cancel_bot_join_tasks()
    lobbies["pending_bots"] = []
    cancel_lobby_timer_task()

    await sio.emit("all_players_ready", {}, room=PUBLIC_LOBBY_ROOM)  # pyright: ignore[reportUnknownMemberType]
    await asyncio.sleep(LOBBY_READY_PAUSE_SECONDS)
    if not await emit_game_countdown_start(room=PUBLIC_LOBBY_ROOM):
        return
    await asyncio.sleep(GAME_COUNTDOWN_SECONDS)
    await start_public_game()


def private_room_player_payload(room: PrivateRoom) -> list[dict[str, object]]:
    return [
        {
            "sid": player["sid"],
            "name": player["name"],
            "nickname": player["name"],
            "avatar": player["avatar"],
            "is_host": player["sid"] == room["host_sid"],
        }
        for player in room["players"]
    ]


def private_room_created_payload(room: PrivateRoom, *, is_host: bool) -> dict[str, object]:
    return {
        "room_code": room["code"],
        "players": private_room_player_payload(room),
        "host_sid": room["host_sid"],
        "is_host": is_host,
    }


async def emit_lobby_status(seconds_left: int) -> None:
    for player in lobbies["players"]:
        if not player["is_bot"]:
            payload = {
                "players": lobby_status_players(player["sid"]),
                "seconds_left": seconds_left,
            }
            await sio.emit("lobby_status", payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]


def reset_lobby(cancel_timer: bool = True) -> None:
    if cancel_timer:
        cancel_lobby_timer_task()

    cancel_bot_join_tasks()
    lobbies["players"] = []
    lobbies["timer_task"] = None
    lobbies["pending_bots"] = []
    lobbies["game_starting"] = False
    lobbies["countdown_started"] = False


def human_avatars_from_players(players: list[Player]) -> set[str]:
    return {player["avatar"] for player in players if not player["is_bot"]}


def make_bot(bot_def: BotDefinition | None = None, *, excluded_avatars: set[str] | None = None) -> Player:
    if bot_def is None:
        picked = pick_pending_bots(1, excluded_avatars=excluded_avatars)
        bot_def = picked[0] if picked else pick_pending_bots(1)[0]
    return {
        "sid": f"bot_{uuid.uuid4().hex}",
        "name": bot_def["name"],
        "avatar": bot_def["avatar"],
        "is_bot": True,
        "score": 0,
        "questions_correct": 0,
        "total_answer_time": 0.0,
        "answered_questions": 0,
        "answer_times": [],
        "current_streak": 0,
        "best_streak": 0,
        "best_round_points": 0,
        "helps_used": new_help_usage(),
        "double_score_active": False,
    }


def make_human_player(sid: str, player_name: str, avatar: str = "🦊") -> Player:
    return {
        "sid": sid,
        "name": player_name,
        "avatar": avatar,
        "is_bot": False,
        "score": 0,
        "questions_correct": 0,
        "total_answer_time": 0.0,
        "answered_questions": 0,
        "answer_times": [],
        "current_streak": 0,
        "best_streak": 0,
        "best_round_points": 0,
        "helps_used": new_help_usage(),
        "double_score_active": False,
    }


def new_help_usage() -> HelpUsage:
    return {
        "fifty_fifty": False,
        "call_a_friend": False,
        "double_score": False,
    }


def time_limit_for_difficulty(difficulty: int) -> int:
    if difficulty <= 3:
        return 20
    if difficulty <= 6:
        return 15
    return 30


def time_limit_for_question(question: TriviaQuestion) -> int:
    return time_limit_for_difficulty(question["difficulty"])


async def get_next_question(room: Room, difficulty: int) -> TriviaQuestion | None:
    used_ids = room["used_question_ids"]
    rows = await get_questions_by_difficulty(difficulty, 1, exclude_ids=used_ids)
    if not rows:
        return None
    question = question_from_row(rows[0])
    used_ids.add(question["id"])
    return question


async def load_questions(room: Room) -> None:
    used_ids = room["used_question_ids"]
    rows = await get_questions_by_difficulty(
        room["current_difficulty"],
        QUESTIONS_PER_GAME,
        exclude_ids=used_ids,
    )
    questions = [question_from_row(row) for row in rows]
    for question in questions:
        used_ids.add(question["id"])
    room["questions"] = questions


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


def player_scores(room: Room) -> list[dict[str, int | str | bool]]:
    return [
        {
            "name": player["name"],
            "nickname": player["name"],
            "avatar": player["avatar"],
            "is_bot": player["is_bot"],
            "score": player["score"],
        }
        for player in room["players"]
    ]


def debug_timestamp(timestamp: float | None) -> str:
    if timestamp is None:
        return "not recorded"
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


async def emit_to_humans(room: Room, event: str, payload: object) -> None:
    for player in room["players"]:
        if not player["is_bot"]:
            await sio.emit(event, payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]


async def lobby_countdown() -> None:
    global lobby_seconds_left

    try:
        for seconds_left in range(LOBBY_WAIT, 0, -1):
            if lobbies["game_starting"]:
                return

            lobby_seconds_left = seconds_left
            await emit_lobby_status(seconds_left)
            await asyncio.sleep(1)

        lobby_seconds_left = 0
        if not lobbies["game_starting"]:
            await trigger_public_lobby_game_start()
    except asyncio.CancelledError:
        return


async def start_public_game() -> None:
    players = list(lobbies["players"])
    if not players:
        reset_lobby(cancel_timer=False)
        return

    await start_game_from_players(players, "public", None, skip_bot_fill=True)
    reset_lobby(cancel_timer=False)


async def start_game_from_players(
    players: list[Player],
    room_type: RoomType,
    room_code: str | None,
    *,
    pending_bots: list[BotDefinition] | None = None,
    skip_bot_fill: bool = False,
) -> Room:
    players = list(players)
    human_players = [player for player in players if not player["is_bot"]]
    if len(human_players) == 1 and not skip_bot_fill:
        excluded = human_avatars_from_players(players)
        if room_type == "private":
            bot_defs = pick_pending_bots(2, excluded_avatars=excluded)
        else:
            bot_defs = pending_bots if pending_bots else pick_pending_bots(random.randint(1, 3), excluded_avatars=excluded)
        players.extend(make_bot(bot_def) for bot_def in bot_defs)

    room_id = str(uuid.uuid4())
    room: Room = {
        "id": room_id,
        "room_type": room_type,
        "room_code": room_code,
        "players": players,
        "questions": [],
        "used_question_ids": set(),
        "current_q_index": 0,
        "current_difficulty": 5,
        "pending_answers_this_round": {},
        "answers_this_round": {},
        "question_start_time": 0.0,
        "question_sent_at": {},
        "current_question_options": [],
        "active": True,
    }
    rooms[room_id] = room

    payload = {
        "room_id": room_id,
        "players": [
            {
                "nickname": player["name"],
                "name": player["name"],
                "avatar": player["avatar"],
                "is_bot": player["is_bot"],
                "score": player["score"],
            }
            for player in players
        ],
    }
    for player in human_players:
        await sio.emit("game_starting", payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]
        await sio.emit("game_start", payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]
        await sio.enter_room(player["sid"], room_id)  # pyright: ignore[reportUnknownMemberType]

    await load_questions(room)
    _ = asyncio.create_task(run_game(room))
    return room


async def run_game(room: Room) -> None:
    for question_index in range(min(QUESTIONS_PER_GAME, len(room["questions"]))):
        if not room["active"]:
            return

        room["current_q_index"] = question_index
        room["pending_answers_this_round"] = {}
        room["answers_this_round"] = {}
        room["question_start_time"] = time.time()
        room["question_sent_at"] = {}

        question = room["questions"][question_index]
        time_limit = time_limit_for_question(question)
        options = question_options(question)
        room["current_question_options"] = options
        question_payload = {
            "question_id": question["id"],
            "question": question["question"],
            "options": options,
            "difficulty": question["difficulty"],
            "round": question_index + 1,
            "question_number": question_index + 1,
            "time_limit": time_limit,
        }
        for player in room["players"]:
            if player["is_bot"]:
                continue
            sent_at = time.time()
            room["question_sent_at"][player["sid"]] = sent_at
            print(
                f"[QUESTION SENT] Question: {question['question']} | player={player['name']} "
                f"| sent_at={debug_timestamp(sent_at)} | question_start={debug_timestamp(room['question_start_time'])}"
            )
            await sio.emit("question", question_payload, to=player["sid"])  # pyright: ignore[reportUnknownMemberType]

        for player in room["players"]:
            if player["is_bot"]:
                sent_at = time.time()
                room["question_sent_at"][player["sid"]] = sent_at
                print(
                    f"[QUESTION SENT] Question: {question['question']} | player={player['name']} "
                    f"| sent_at={debug_timestamp(sent_at)} | question_start={debug_timestamp(room['question_start_time'])}"
                )
                _ = asyncio.create_task(run_bot(player, question, room, sio))

        await wait_for_round_end(room)
        auto_submit_pending_answers(room)
        round_scores = grade_round(room, question)
        round_winner = next((score for score in round_scores if score["is_top_scorer"]), None)
        await adapt_difficulty(room)
        await sio.emit(  # pyright: ignore[reportUnknownMemberType]
            "round_result",
            {
                "correct_answer": question["correct_answer"],
                "scores": player_scores(room),
                "round_scores": round_scores,
                "player_results": round_scores,
                "round_winner": (
                    {
                        "nickname": round_winner["nickname"],
                        "avatar": round_winner["avatar"],
                        "points_earned": round_winner["points_earned"],
                    }
                    if round_winner is not None
                    else None
                ),
                "display_seconds": ROUND_RESULT_PAUSE_SECONDS,
            },
            to=room["id"],
        )
        await asyncio.sleep(ROUND_RESULT_PAUSE_SECONDS)

    await end_game(room)


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def select_answer(sid: str, data: dict[str, object]) -> None:
    room = find_active_room_for_sid(sid)
    if room is None:
        return

    if sid in room["answers_this_round"]:
        return

    if time_remaining_for_room(room) <= 0:
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

    room["pending_answers_this_round"][sid] = {
        "answer": str(answer_value),
    }


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def submit_answer(sid: str, data: dict[str, object]) -> None:
    submit_answer_for_sid(sid, data)


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def answer(sid: str, data: dict[str, object]) -> None:
    submit_answer_for_sid(sid, data)


async def wait_for_round_end(room: Room) -> None:
    deadline = room["question_start_time"] + current_question_time_limit(room)
    while time.time() < deadline:
        if all_players_locked(room):
            return
        await asyncio.sleep(0.1)


def all_players_locked(room: Room) -> bool:
    return all(player["sid"] in room["answers_this_round"] for player in room["players"])


def submit_answer_for_sid(sid: str, data: dict[str, object]) -> None:
    room = find_active_room_for_sid(sid)
    if room is None:
        return

    if sid in room["answers_this_round"]:
        return

    question = current_question(room)
    if question is None:
        return
    time_limit = time_limit_for_question(question)

    submit_time = time.time()
    elapsed = max(0.0, submit_time - room["question_start_time"])
    server_time_remaining = max(0.0, time_limit - elapsed)
    if server_time_remaining <= 0:
        return

    question_id = data.get("question_id")
    if question_id is not None and int(str(question_id)) != question["id"]:
        return

    answer_value = data.get("answer")
    if answer_value is None:
        return

    time_taken = max(0.0, min(time_limit, elapsed))

    room["answers_this_round"][sid] = {
        "answer": str(answer_value),
        "time_taken": time_taken,
        "submitted_at": submit_time,
    }
    room["pending_answers_this_round"].pop(sid, None)

    player = find_player_in_room(room, sid)
    player_name = player["name"] if player is not None else sid
    sent_at = room["question_sent_at"].get(sid, room["question_start_time"])
    print(
        f"[ANSWER SUBMITTED] player={player_name} | sent_at={debug_timestamp(sent_at)} "
        f"| submitted_at={debug_timestamp(submit_time)} | elapsed={time_taken:.2f}s"
    )


def time_remaining_for_room(room: Room) -> float:
    elapsed = time.time() - room["question_start_time"]
    return max(0.0, current_question_time_limit(room) - elapsed)


def current_question_time_limit(room: Room) -> int:
    question = current_question(room)
    if question is None:
        return time_limit_for_difficulty(room["current_difficulty"])
    return time_limit_for_question(question)


def parse_time_remaining(value: object) -> float | None:
    if value is None:
        return None

    try:
        return max(0.0, min(time_limit_for_difficulty(10), float(value)))
    except (TypeError, ValueError):
        return None


def auto_submit_pending_answers(room: Room) -> None:
    time_limit = current_question_time_limit(room)
    for sid, answer_record in list(room["pending_answers_this_round"].items()):
        if sid in room["answers_this_round"]:
            continue
        submit_time = time.time()
        elapsed = max(0.0, min(time_limit, submit_time - room["question_start_time"]))
        room["answers_this_round"][sid] = {
            "answer": answer_record["answer"],
            "time_taken": elapsed,
            "submitted_at": submit_time,
        }
        player = find_player_in_room(room, sid)
        player_name = player["name"] if player is not None else sid
        sent_at = room["question_sent_at"].get(sid, room["question_start_time"])
        print(
            f"[ANSWER SUBMITTED] player={player_name} | sent_at={debug_timestamp(sent_at)} "
            f"| submitted_at={debug_timestamp(submit_time)} | elapsed={elapsed:.2f}s | auto_submit=true"
        )


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

    has_selected = sid in room["pending_answers_this_round"]
    has_locked = sid in room["answers_this_round"]

    if help_type == "fifty_fifty" and (has_selected or has_locked):
        await sio.emit(  # pyright: ignore[reportUnknownMemberType]
            "help_error",
            {"type": help_type, "message": "50/50 is only available before choosing an answer."},
            to=sid,
        )
        return

    if help_type == "call_a_friend" and has_locked:
        await sio.emit(  # pyright: ignore[reportUnknownMemberType]
            "help_error",
            {"type": help_type, "message": "Call a Friend is only available before locking in."},
            to=sid,
        )
        return

    player["helps_used"][help_type] = True

    if help_type == "fifty_fifty":
        remaining_options = fifty_fifty_options(question)
        await sio.emit("fifty_fifty_result", {"remaining_options": remaining_options}, to=sid)  # pyright: ignore[reportUnknownMemberType]
        return

    if help_type == "call_a_friend":
        fallback_advice = {
            "advice": (
                "My neural link is fuzzy today! Trust your gut — you know "
                "more than you think. Go get em champion! 🏆"
            ),
            "confidence": 75,
        }
        pregenerated = await get_pregenerated_friend_advice(question["id"])
        if pregenerated is not None:
            await sio.emit("friend_advice", pregenerated, to=sid)  # pyright: ignore[reportUnknownMemberType]
            return
        try:
            question_for_friend = dict(question)
            question_for_friend["answers"] = room.get("current_question_options", question_options(question))
            result = await get_friend_advice(question_for_friend)
            await sio.emit(  # pyright: ignore[reportUnknownMemberType]
                "friend_advice",
                {"advice": result["advice"], "confidence": result["confidence"]},
                to=sid,
            )
        except Exception as error:
            print(f"[CALL A FRIEND ERROR] {error}")
            player["helps_used"]["call_a_friend"] = False
            await sio.emit("friend_advice", fallback_advice, to=sid)  # pyright: ignore[reportUnknownMemberType]
        return

    player["double_score_active"] = True
    await sio.emit("double_score_active", {"active": True}, to=sid)  # pyright: ignore[reportUnknownMemberType]


def find_player_in_room(room: Room, sid: str) -> Player | None:
    for player in room["players"]:
        if player["sid"] == sid:
            return player
    return None


def normalize_room_code(code: object) -> str:
    return str(code).strip().upper()


def generate_room_code() -> str:
    alphabet = string.ascii_uppercase
    suffix_alphabet = string.ascii_uppercase + string.digits

    for _ in range(100):
        prefix = "".join(random.choice(alphabet) for _ in range(4))
        suffix = "".join(random.choice(suffix_alphabet) for _ in range(2))
        code = f"{prefix}-{suffix}"
        if code not in private_rooms:
            return code

    return f"{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:2].upper()}"


def private_room_for_sid(sid: str) -> PrivateRoom | None:
    for room in private_rooms.values():
        if any(player["sid"] == sid for player in room["players"]):
            return room
    return None


def find_player_in_private_room(room: PrivateRoom, sid: str) -> Player | None:
    for player in room["players"]:
        if player["sid"] == sid:
            return player
    return None


def remove_player_from_waiting_rooms(sid: str, skip_private_code: str | None = None) -> None:
    lobbies["players"] = [player for player in lobbies["players"] if player["sid"] != sid]
    if not lobbies["players"]:
        reset_lobby()

    empty_codes: list[str] = []
    for code, room in private_rooms.items():
        if code == skip_private_code:
            continue
        if room["started"]:
            continue

        room["players"] = [player for player in room["players"] if player["sid"] != sid]
        if not room["players"]:
            empty_codes.append(code)
            continue

        if room["host_sid"] == sid:
            room["host_sid"] = room["players"][0]["sid"]

    for code in empty_codes:
        del private_rooms[code]


async def emit_private_room_status(room: PrivateRoom) -> None:
    payload = {
        "room_code": room["code"],
        "players": private_room_player_payload(room),
        "host_sid": room["host_sid"],
        "can_start": len(room["players"]) >= 1,
    }
    await sio.emit("player_joined", payload, room=room["code"])  # pyright: ignore[reportUnknownMemberType]
    await sio.emit("player_joined_room", payload, room=room["code"])  # pyright: ignore[reportUnknownMemberType]


async def notify_player_joined(room: PrivateRoom, player_name: str) -> None:
    await sio.emit(  # pyright: ignore[reportUnknownMemberType]
        "player_joined_notification",
        {
            "player_name": player_name,
            "message": f"🎉 {player_name} joined the room!",
        },
        room=room["code"],
    )


async def emit_private_room_error(sid: str, message: str, code: str = "private_room_error") -> None:
    await sio.emit("private_room_error", {"message": message, "code": code}, to=sid)  # pyright: ignore[reportUnknownMemberType]


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


def grade_round(room: Room, question: TriviaQuestion) -> list[dict[str, object]]:
    round_scores: list[dict[str, object]] = []
    time_limit = time_limit_for_question(question)

    for player in room["players"]:
        answer_record = room["answers_this_round"].get(player["sid"])
        points = 0
        is_correct = False
        time_taken = None

        if answer_record is None:
            player["current_streak"] = 0
            player["double_score_active"] = False
            round_scores.append(
                {
                    "nickname": player["name"],
                    "avatar": player["avatar"],
                    "was_correct": is_correct,
                    "points_earned": points,
                    "time_taken": time_taken,
                    "name": player["name"],
                    "points": points,
                    "correct": is_correct,
                    "answer": None,
                    "is_top_scorer": False,
                    "label": "",
                }
            )
            continue

        player["answered_questions"] += 1
        player["total_answer_time"] += max(0.0, min(time_limit, answer_record["time_taken"]))

        time_taken = max(0.0, min(time_limit, answer_record["time_taken"]))
        is_correct = answers_match(answer_record["answer"], question["correct_answer"])
        points = calculate_round_score(is_correct, time_taken, time_limit)
        player["double_score_active"] = False

        if is_correct:
            player["score"] += points
            player["questions_correct"] += 1
            player["answer_times"].append(time_taken)
            player["current_streak"] += 1
            player["best_streak"] = max(player["best_streak"], player["current_streak"])
            player["best_round_points"] = max(player["best_round_points"], points)
        else:
            player["current_streak"] = 0

        if not player["is_bot"]:
            print(
                f"[PLAYER SUBMIT] {player['name']} answered {answer_record['answer']} "
                f"→ correct={is_correct}, score={points}"
            )

        round_scores.append(
            {
                "nickname": player["name"],
                "avatar": player["avatar"],
                "was_correct": is_correct,
                "points_earned": points,
                "time_taken": round(float(time_taken), 1),
                "name": player["name"],
                "points": points,
                "correct": is_correct,
                "answer": answer_record["answer"],
                "is_top_scorer": False,
                "label": "",
            }
        )

    top_points = max((int(score["points"]) for score in round_scores), default=0)
    if top_points > 0:
        top_labels = ["FASTEST! ⚡", "ON FIRE! 🔥", "CORRECT! ✅"]
        label_index = 0
        for score in round_scores:
            if score["points"] == top_points:
                score["is_top_scorer"] = True
                score["label"] = top_labels[label_index % len(top_labels)]
                label_index += 1

    log_round_result(room, question, round_scores, time_limit)
    return round_scores


def calculate_round_score(correct: bool, elapsed: float, time_limit: int) -> int:
    max_points = 1000
    time_bonus = max(0, (time_limit - elapsed) / time_limit)
    return int(max_points * time_bonus) if correct else 0


def log_round_result(room: Room, question: TriviaQuestion, round_scores: list[dict[str, object]], time_limit: int) -> None:
    print(f"[ROUND RESULT] Question: {question['question']}")
    for player, score in zip(room["players"], round_scores, strict=False):
        answer_record = room["answers_this_round"].get(player["sid"])
        sent_at = room["question_sent_at"].get(player["sid"], room["question_start_time"])
        score_points = int(score["points"])

        if answer_record is None:
            print(
                f"  {player['name']}: sent_at={debug_timestamp(sent_at)} | submitted_at=none "
                f"| elapsed=none | correct=false | score_calc=0 pts | final=0 pts"
            )
            continue

        submitted_at = answer_record["submitted_at"]
        elapsed = max(0.0, min(time_limit, answer_record["time_taken"]))
        correct = bool(score["correct"])
        time_bonus = max(0, (time_limit - elapsed) / time_limit)
        print(
            f"  {player['name']}: sent_at={debug_timestamp(sent_at)} | submitted_at={debug_timestamp(submitted_at)} "
            f"| elapsed={elapsed:.2f}s | correct={str(correct).lower()} "
            f"| score_calc=int(1000 * {time_bonus:.4f}) if correct else 0 = {score_points} pts "
            f"| final={score_points} pts"
        )
        print(f"  {player['name']}: answered in {elapsed:.2f}s -> {score_points} pts")


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

    next_question = await get_next_question(room, room["current_difficulty"])
    if next_question is None:
        return

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
            "avatar": player["avatar"],
            "is_bot": player["is_bot"],
            "score": player["score"],
            "questions_correct": player["questions_correct"],
            "avg_speed": round(sum(player["answer_times"]) / len(player["answer_times"]), 1)
            if player["answer_times"]
            else 0,
            "best_streak": player["best_streak"],
            "best_round": player["best_round_points"],
            "best_round_points": player["best_round_points"],
        }
        for player in leaderboard_players
    ]

    await emit_to_humans(room, "game_over", {"leaderboard": leaderboard, "rounds_complete": QUESTIONS_PER_GAME})

    for player in leaderboard_players:
        if player["is_bot"]:
            continue
        await save_game_log(player, room["id"])

    room_code = room["room_code"]
    if room_code is not None and room_code in private_rooms:
        del private_rooms[room_code]

    del rooms[room["id"]]


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def join_lobby(sid: str, data: dict[str, str]) -> None:
    player_name = data.get("player_name", "").strip()
    if not player_name:
        player_name = "Anonymous"
    avatar = data.get("avatar", "🦊")

    remove_player_from_waiting_rooms(sid)
    lobbies["players"] = [player for player in lobbies["players"] if player["sid"] != sid]
    was_empty = len(lobbies["players"]) == 0
    lobbies["players"].append(make_human_player(sid, player_name, avatar))
    await sio.enter_room(sid, PUBLIC_LOBBY_ROOM)  # pyright: ignore[reportUnknownMemberType]

    human_count = len(lobby_human_players())
    if human_count >= MAX_LOBBY_PLAYERS:
        cancel_bot_join_tasks()
        lobbies["pending_bots"] = []
    else:
        reschedule_public_lobby_bots()

    if was_empty:
        lobbies["game_starting"] = False
        lobbies["countdown_started"] = False
        global lobby_seconds_left
        lobby_seconds_left = LOBBY_WAIT
        lobbies["timer_task"] = asyncio.create_task(lobby_countdown())
    await emit_lobby_status(lobby_seconds_left)


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def create_private_room(sid: str, data: dict[str, str]) -> dict[str, object]:
    print(f"=== CREATE ROOM REQUEST from {sid} ===", flush=True)
    player_name = data.get("player_name", "").strip() or "Player"
    avatar = data.get("avatar", "🦊")
    remove_player_from_waiting_rooms(sid)

    code = generate_room_code()
    room: PrivateRoom = {
        "code": code,
        "host_sid": sid,
        "players": [make_human_player(sid, player_name, avatar)],
        "status": "waiting",
        "started": False,
        "room_id": None,
        "countdown_started": False,
    }
    private_rooms[code] = room
    await sio.enter_room(sid, code)  # pyright: ignore[reportUnknownMemberType]

    payload = private_room_created_payload(room, is_host=True)
    print(f"=== EMITTING room_created with code: {code} ===", flush=True)
    print(f"Room {code} created by {player_name} ({sid})", flush=True)
    await sio.emit("room_created", payload, to=sid)  # pyright: ignore[reportUnknownMemberType]
    await sio.emit("private_room_created", payload, to=sid)  # pyright: ignore[reportUnknownMemberType]
    await emit_private_room_status(room)
    return payload


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def join_private_room(sid: str, data: dict[str, str] | str) -> dict[str, object]:
    if isinstance(data, dict):
        code = normalize_room_code(data.get("code", ""))
        player_name = data.get("player_name", "").strip()
        avatar = data.get("avatar", "🦊")
    else:
        code = normalize_room_code(data)
        player_name = ""
        avatar = "🦊"

    room = private_rooms.get(code)
    if room is None:
        message = "Room not found! Check the code 🤔"
        if player_name:
            await emit_private_room_error(sid, message, "room_not_found")
        return {"ok": False, "error": "room_not_found", "message": message}

    if room["status"] != "waiting" or room["started"]:
        message = "Game already in progress! ⏳"
        if player_name:
            await emit_private_room_error(sid, message, "game_started")
        return {"ok": False, "error": "game_started", "message": message}

    if not player_name:
        return {
            "ok": True,
            "room_code": code,
            "players": private_room_player_payload(room),
            "host_sid": room["host_sid"],
        }

    remove_player_from_waiting_rooms(sid, skip_private_code=code)
    room["players"] = [player for player in room["players"] if player["sid"] != sid]
    room["players"].append(make_human_player(sid, player_name, avatar))
    await sio.enter_room(sid, code)  # pyright: ignore[reportUnknownMemberType]
    payload = {
        "ok": True,
        **private_room_created_payload(room, is_host=False),
    }
    await sio.emit("room_joined", payload, to=sid)  # pyright: ignore[reportUnknownMemberType]
    await sio.emit("join_success", payload, to=sid)  # pyright: ignore[reportUnknownMemberType]
    await notify_player_joined(room, player_name)
    await emit_private_room_status(room)
    return payload


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def start_private_game(sid: str, data: dict[str, str] | None = None) -> dict[str, object]:
    code = ""
    if data is not None:
        code = normalize_room_code(data.get("code", "") or data.get("room_code", ""))

    room = private_rooms.get(code) if code else private_room_for_sid(sid)
    if room is None:
        message = "Room not found! Check the code 🤔"
        await emit_private_room_error(sid, message)
        return {"ok": False, "message": message}

    if room["host_sid"] != sid:
        message = "Only the host can start this room."
        await emit_private_room_error(sid, message)
        return {"ok": False, "message": message}

    if room["status"] != "waiting" or room["started"]:
        message = "Game already in progress! ⏳"
        await emit_private_room_error(sid, message, "game_started")
        return {"ok": False, "message": message}

    if not room["players"]:
        message = "Room is empty."
        await emit_private_room_error(sid, message)
        return {"ok": False, "message": message}

    if data is not None:
        player = find_player_in_private_room(room, sid)
        if player is not None:
            player_name = data.get("player_name", "").strip()
            if player_name:
                player["name"] = player_name
            player["avatar"] = data.get("avatar", player["avatar"])

    if room["countdown_started"]:
        return {"ok": False, "message": "Game already starting."}

    room["status"] = "in_game"
    room["started"] = True
    room["countdown_started"] = True

    await sio.emit("game_countdown_start", {}, room=room["code"])  # pyright: ignore[reportUnknownMemberType]
    await asyncio.sleep(GAME_COUNTDOWN_SECONDS)

    active_room = await start_game_from_players(room["players"], "private", room["code"])
    room["room_id"] = active_room["id"]
    game_payload = {
        "ok": True,
        "room_id": active_room["id"],
        "players": [player["name"] for player in active_room["players"]],
    }
    await sio.emit("game_start", game_payload, room=room["code"])  # pyright: ignore[reportUnknownMemberType]
    return game_payload


@sio.event  # pyright: ignore[reportUnknownMemberType]
async def disconnect(sid: str) -> None:
    lobbies["players"] = [player for player in lobbies["players"] if player["sid"] != sid]

    if not lobbies["players"]:
        reset_lobby()
    else:
        human_count = len(lobby_human_players())
        if human_count >= MAX_LOBBY_PLAYERS:
            cancel_bot_join_tasks()
            lobbies["pending_bots"] = []
        elif human_count > 0:
            reschedule_public_lobby_bots()
            await emit_lobby_status(lobby_seconds_left)

    affected_private_rooms: list[PrivateRoom] = []
    empty_codes: list[str] = []
    for code, room in private_rooms.items():
        if room["started"]:
            continue
        original_count = len(room["players"])
        room["players"] = [player for player in room["players"] if player["sid"] != sid]
        if len(room["players"]) == original_count:
            continue
        if not room["players"]:
            empty_codes.append(code)
            continue
        if room["host_sid"] == sid:
            room["host_sid"] = room["players"][0]["sid"]
            await sio.emit(  # pyright: ignore[reportUnknownMemberType]
                "host_promoted",
                {
                    "room_code": code,
                    "host_sid": room["host_sid"],
                    "is_host": True,
                    "message": "👑 You are now the host!",
                },
                to=room["host_sid"],
            )
        affected_private_rooms.append(room)

    for code in empty_codes:
        del private_rooms[code]

    for room in affected_private_rooms:
        await emit_private_room_status(room)


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
    client_id = str(data.get("client_id", "")).strip()

    await sio.emit(  # pyright: ignore[reportUnknownMemberType]
        "chat_message",
        {
            "client_id": client_id,
            "player_name": player["name"],
            "avatar": player["avatar"],
            "is_bot": player["is_bot"],
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
