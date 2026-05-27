import asyncio
import random
import time
from datetime import datetime, timezone
from typing import Protocol, TypedDict

BOT_CHAT_MESSAGES = [
    "I knew that one! 😎",
    "Hmm that was tricky...",
    "Easy points 🎯",
    "Lucky guess 🤞",
    "Come on, everyone knows that!",
    "Too slow humans! 🤖",
    "My circuits are tingling...",
    "Calculating... 🧮",
]


class BotPlayer(TypedDict):
    sid: str
    name: str
    avatar: str


class BotQuestion(TypedDict):
    correct_answer: str
    wrong_answer_1: str
    wrong_answer_2: str
    wrong_answer_3: str
    difficulty: int


class BotAnswerRecord(TypedDict):
    answer: str
    time_taken: float
    submitted_at: float


class BotRoom(TypedDict):
    id: str
    answers_this_round: dict[str, BotAnswerRecord]
    question_start_time: float
    active: bool


class SocketEmitter(Protocol):
    async def emit(self, event: str, data: object | None = None, to: str | None = None) -> None: ...


async def run_bot(bot: BotPlayer, question: BotQuestion, room: BotRoom, sio: SocketEmitter) -> None:
    delay = random.uniform(3.5, 11.0)
    await asyncio.sleep(delay)

    if not room["active"]:
        return
    if bot["sid"] in room["answers_this_round"]:
        return

    bot_accuracy = 0.65
    if random.random() < bot_accuracy:
        answer = question["correct_answer"]
    else:
        wrong_answers = [
            question["wrong_answer_1"],
            question["wrong_answer_2"],
            question["wrong_answer_3"],
        ]
        answer = random.choice(wrong_answers)

    submit_time = time.time()
    elapsed = max(0.0, submit_time - room["question_start_time"])
    room["answers_this_round"][bot["sid"]] = {
        "answer": answer,
        "time_taken": elapsed,
        "submitted_at": submit_time,
    }
    print(
        f"[ANSWER SUBMITTED] player={bot['name']} "
        f"| submitted_at={datetime.fromtimestamp(submit_time, timezone.utc).isoformat()} "
        f"| elapsed={elapsed:.2f}s | bot=true"
    )

    if random.random() < 0.3:
        await sio.emit(
            "chat_message",
            {
                "player_name": bot["name"],
                "avatar": bot.get("avatar", "🤖"),
                "is_bot": True,
                "text": random.choice(BOT_CHAT_MESSAGES),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            to=room["id"],
        )
