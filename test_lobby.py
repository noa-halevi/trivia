import socketio
import time
import threading

def make_player(name, join_delay=0):
    sio = socketio.SimpleClient()
    
    time.sleep(join_delay)
    sio.connect("http://localhost:8000")
    print(f"[{name}] Connected")
    
    sio.emit("join_lobby", {"player_name": name})
    print(f"[{name}] Sent join_lobby")
    
    # האזן לאירועים 40 שניות
    start = time.time()
    while time.time() - start < 40:
        try:
            event = sio.receive(timeout=2)
            print(f"[{name}] GOT: {event}")
        except:
            pass
    
    sio.disconnect()

# --- בחר איזה טסט להריץ ---

# טסט 1: שחקן אחד (אמור לקבל בוטים)
threading.Thread(target=make_player, args=("Yossi",)).start()

# טסט 2: שני שחקנים — פתח הערה ל-2 השורות האלה
# threading.Thread(target=make_player, args=("Yossi",)).start()
# threading.Thread(target=make_player, args=("Dana", 3)).start()