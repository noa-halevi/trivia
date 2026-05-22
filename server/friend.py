from dotenv import load_dotenv
from pydantic import BaseModel
from pydantic_ai import Agent

_ = load_dotenv()


class FriendAdvice(BaseModel):
    advice: str


async def get_friend_advice(question: dict[str, object]) -> str:
    agent = Agent(
        "openai:gpt-4o-mini",
        output_type=FriendAdvice,
        system_prompt=(
            "You are a friend who kind of knows trivia but isn't totally sure. "
            "Give a playful 2-sentence hint. Do NOT reveal the answer directly."
        ),
    )
    result = await agent.run(f"The question is: {question['question']}")
    return result.output.advice
