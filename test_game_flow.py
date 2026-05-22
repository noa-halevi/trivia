import sqlite3
import socketio
import time
import threading
from pathlib import Path

BASE_URL = "http://localhost:8000"
DB_PATH = Path(__file__).resolve().parent / "data" / "trivia_questions.db"


def get_correct_answer(question_id):
    with sqlite3.connect(DB_PATH) as connection:
        row = connection.execute(
            """
            SELECT correct_answer
            FROM trivia_questions
            WHERE id = ?
            """,
            (question_id,),
        ).fetchone()

    if row is None:
        raise ValueError(f"Question id {question_id} was not found in {DB_PATH}")

    return row[0]

def make_player(name, answer_strategy="correct", join_delay=0):
    """
    answer_strategy:
      "correct"  - תמיד עונה נכון מיד
      "slow"     - עונה נכון אחרי 10 שניות
      "wrong"    - תמיד עונה לא נכון
      "silent"   - לא עונה בכלל
    """
    sio = socketio.SimpleClient()
    time.sleep(join_delay)
    sio.connect(BASE_URL)
    sio.emit("join_lobby", {"player_name": name})
    print(f"[{name}] Connected & joined lobby")

    current_question = {}

    start = time.time()
    while time.time() - start < 120:
        try:
            event = sio.receive(timeout=2)
            event_name, data = event[0], event[1]

            # --- LOBBY ---
            if event_name == "lobby_status":
                print(f"[{name}] Lobby: {data['players']} | {data['seconds_left']}s left")

            # --- GAME STARTING ---
            elif event_name == "game_starting":
                print(f"\n[{name}] 🎮 GAME STARTING — players: {data['players']}\n")

            # --- QUESTION RECEIVED ---
            elif event_name == "question":
                current_question = data
                print(f"\n[{name}] ❓ Q{data['question_number']}/10 "
                      f"(difficulty={data['difficulty']}): {data['question']}")
                print(f"[{name}]    Options: {data['options']}")

                # החלט מה לענות לפי האסטרטגיה
                correct_answer = get_correct_answer(data["question_id"])
                print(f"[{name}]    Correct answer from local DB: {correct_answer}")

                answer = correct_answer
                delay = 2

                if answer_strategy == "correct":
                    answer = correct_answer
                    delay = 2  # מהיר

                elif answer_strategy == "slow":
                    answer = correct_answer
                    delay = 10  # איטי

                elif answer_strategy == "wrong":
                    answer = "__wrong_answer__"
                    delay = 2

                elif answer_strategy == "silent":
                    print(f"[{name}]    💤 Not answering this round")
                    continue

                # שלח תשובה אחרי delay
                def send_answer(s, q, a, d):
                    time.sleep(d)
                    s.emit("answer", {
                        "question_id": q["question_id"],
                        "answer": a
                    })
                    print(f"[{name}]    ✉️  Sent answer: '{a}' after {d}s")

                threading.Thread(
                    target=send_answer,
                    args=(sio, data, answer, delay)
                ).start()

            # --- ROUND RESULT ---
            elif event_name == "round_result":
                print(f"[{name}] 📊 Round result — correct: {data['correct_answer']}")
                print(f"[{name}]    Scores: {data['scores']}")

            # --- GAME OVER ---
            elif event_name == "game_over":
                print(f"\n[{name}] 🏆 GAME OVER — Leaderboard:")
                for i, p in enumerate(data["leaderboard"], 1):
                    print(f"         {i}. {p['name']} — {p['score']} pts "
                          f"({p['questions_correct']}/10 correct)")
                break

        except Exception:
            pass

    sio.disconnect()
    print(f"[{name}] Disconnected")


# ============================================================
# בחר איזה טסט להריץ — בטל הערה לטסט שרוצה לבדוק
# ============================================================

# --- טסט 1: שחקן אחד עונה נכון תמיד ---
# מטרה: לראות שניקוד עולה, קושי עולה כל שאלה
#threading.Thread(target=make_player, args=("Yossi", "correct")).start()

# --- טסט 2: שחקן מהיר vs שחקן איטי ---
# מטרה: המהיר אמור לקבל יותר נקודות
threading.Thread(target=make_player, args=("Fast", "correct", 0)).start()
# threading.Thread(target=make_player, args=("Slow", "slow", 1)).start()

# --- טסט 3: שחקן עונה לא נכון תמיד ---
# מטרה: ניקוד נשאר 0, קושי יורד כל שאלה
# threading.Thread(target=make_player, args=("Loser", "wrong")).start()

# --- טסט 4: שחקן שלא עונה בכלל ---
# מטרה: 0 נקודות, המשחק ממשיך בלעדיו
# threading.Thread(target=make_player, args=("Ghost", "silent")).start()