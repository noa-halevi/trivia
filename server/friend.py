import random

from dotenv import load_dotenv
from pydantic import BaseModel
from pydantic_ai import Agent

_ = load_dotenv()


class FriendAdvice(BaseModel):
    advice: str


SYSTEM_PROMPT = """
You are a helpful trivia hint giver.
Give ONE sentence only — maximum 10 words.
Hint directly toward the correct answer without saying it.
No encouragement phrases. No filler. Just the hint.

Examples of good hints:
- "Think ancient Egypt and the longest African river."
- "The director also made Schindler's List."  
- "It's the only even prime number."
- "Famous for the Eiffel Tower and baguettes."
- "Think South America, Andes mountains, sun worshippers."
"""


def _question_answers(question: dict[str, object]) -> list[str]:
    answers = question.get("answers")
    if isinstance(answers, list) and len(answers) >= 4:
        return [str(option) for option in answers[:4]]
    options = question.get("options")
    if isinstance(options, list) and len(options) >= 4:
        return [str(option) for option in options[:4]]
    return [
        str(question["correct_answer"]),
        str(question["wrong_answer_1"]),
        str(question["wrong_answer_2"]),
        str(question["wrong_answer_3"]),
    ]


async def get_friend_advice(question: dict[str, object]) -> dict[str, object]:
    answers = _question_answers(question)
    agent = Agent(
        "openai:gpt-4o-mini",
        output_type=FriendAdvice,
        system_prompt=SYSTEM_PROMPT,
    )
    correct = str(question.get("correct_answer", ""))
    user_prompt = (
        f"Question: {question['question']}\n"
        f"Options: A) {answers[0]}  \n"
        f"         B) {answers[1]}  \n"
        f"         C) {answers[2]}  \n"
        f"         D) {answers[3]}\n"
        f"Correct answer (for your eyes only — hint toward this without naming it): {correct}"
    )
    result = await agent.run(user_prompt)
    return {"advice": result.output.advice, "confidence": random.randint(72, 96)}
