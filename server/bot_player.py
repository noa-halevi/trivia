import random
from typing import TypedDict


class BotDefinition(TypedDict):
    name: str
    avatar: str
    title: str


# Player-selectable avatars (must not overlap with bot avatars).
HUMAN_AVATARS: frozenset[str] = frozenset(
    {"🦊", "🐉", "🦁", "🐺", "🦅", "🐙", "🐯", "🦈", "🦄", "🐸"}
)

BOT_AVATARS: frozenset[str] = frozenset(
    {"🧠", "🦉", "🧙", "⚡", "🤖", "💾", "🎯", "🧬", "🔮", "👾", "🦾"}
)

BOT_PROFILES: list[BotDefinition] = [
    {"name": "Simba_The_Boss", "avatar": "🤖", "title": "The Competitor"},
    {"name": "Foxy_Brain", "avatar": "🧠", "title": "The Tactician"},
    {"name": "Lazy_Koala", "avatar": "💾", "title": "The Guesser"},
    {"name": "BrainBot", "avatar": "🔮", "title": "The Nerd"},
    {"name": "WiseOwl", "avatar": "🧬", "title": "The Wise One"},
    {"name": "WizardBot", "avatar": "👾", "title": "The Mystical"},
    {"name": "CircuitSage", "avatar": "⚡", "title": "The Electric"},
    {"name": "RoboQuizz", "avatar": "🎯", "title": "The Sharpshooter"},
    {"name": "ByteBrain", "avatar": "🦾", "title": "The Machine"},
    {"name": "TriviaTron", "avatar": "🧙", "title": "The Oracle"},
]

# Backwards-compatible alias used elsewhere in the codebase.
BOT_ROSTER = BOT_PROFILES


def pick_pending_bots(
    count: int | None = None,
    *,
    excluded_avatars: set[str] | None = None,
) -> list[BotDefinition]:
    bot_count = count if count is not None else random.randint(1, 3)
    bot_count = max(1, min(3, bot_count))

    blocked_avatars = set(excluded_avatars or set()) | set(HUMAN_AVATARS)
    eligible = [bot for bot in BOT_PROFILES if bot["avatar"] not in blocked_avatars]

    if not eligible:
        eligible = list(BOT_PROFILES)

    random.shuffle(eligible)
    selected: list[BotDefinition] = []
    used_avatars: set[str] = set(blocked_avatars)

    for bot in eligible:
        if len(selected) >= bot_count:
            break
        if bot["avatar"] in used_avatars:
            continue
        selected.append(bot)
        used_avatars.add(bot["avatar"])

    return selected
