import asyncio
import random
from datetime import datetime, timezone
from typing import Protocol, TypedDict

BOT_NAMES = ["RoboQuizz", "TriviaTron", "ByteBrain", "CircuitSage", "NeuralNick"]

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


class BotQuestion(TypedDict):
    correct_answer: str
    wrong_answer_1: str
    wrong_answer_2: str
    wrong_answer_3: str
    difficulty: int


class BotAnswerRecord(TypedDict):
    answer: str
    time_taken: float


class BotRoom(TypedDict):
    id: str
    answers_this_round: dict[str, BotAnswerRecord]
    active: bool


class SocketEmitter(Protocol):
    async def emit(self, event: str, data: object | None = None, to: str | None = None) -> None: ...


async def run_bot(bot: BotPlayer, question: BotQuestion, room: BotRoom, sio: SocketEmitter) -> None:
    delay = random.uniform(3, 12)
    await asyncio.sleep(delay)

    if not room["active"]:
        return
    if bot["sid"] in room["answers_this_round"]:
        return

    difficulty = question["difficulty"]
    accuracy = 0.75 - (difficulty - 1) * 0.035

    if random.random() < accuracy:
        answer = question["correct_answer"]
    else:
        wrong_answers = [
            question["wrong_answer_1"],
            question["wrong_answer_2"],
            question["wrong_answer_3"],
        ]
        answer = random.choice(wrong_answers)

    room["answers_this_round"][bot["sid"]] = {
        "answer": answer,
        "time_taken": delay,
    }

    if random.random() < 0.3:
        await sio.emit(
            "chat_message",
            {
                "player_name": bot["name"],
                "text": random.choice(BOT_CHAT_MESSAGES),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            to=room["id"],
        )
