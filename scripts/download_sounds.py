#!/usr/bin/env python3
"""Download royalty-free Mixkit sounds into frontend/public/sounds/."""

import os
import urllib.request

# Primary URLs (Mixkit preview paths). Some preview/music URLs return 403;
# fallbacks use the same assets via working CDN paths (full music / alternate sfx).
sounds = {
    "correct_answer.mp3": "https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
    "wrong_answer.mp3": "https://assets.mixkit.co/active_storage/sfx/2955/2955-preview.mp3",
    "button_click.mp3": "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    "countdown.mp3": "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    "round_win.mp3": "https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3",
    "game_over.mp3": "https://assets.mixkit.co/active_storage/sfx/2027/2027-preview.mp3",
    "streak.mp3": "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3",
    "lifeline_use.mp3": "https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3",
    "chat_message.mp3": "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
    "tick.mp3": "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    "title_music.mp3": "https://assets.mixkit.co/active_storage/music/preview/mixkit-games-worldbeat-466.mp3",
    "gameplay_music.mp3": "https://assets.mixkit.co/active_storage/music/preview/mixkit-game-level-music-689.mp3",
}

fallbacks = {
    "button_click.mp3": "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3",
    "title_music.mp3": "https://assets.mixkit.co/music/466/466.mp3",
    "gameplay_music.mp3": "https://assets.mixkit.co/music/689/689.mp3",
}

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; TriviumSoundDownloader/1.0)",
}

output_dir = "frontend/public/sounds"
os.makedirs(output_dir, exist_ok=True)


def download_file(url: str, path: str) -> None:
    request = urllib.request.Request(url, headers=REQUEST_HEADERS)
    with urllib.request.urlopen(request) as response, open(path, "wb") as out_file:
        out_file.write(response.read())


for filename, url in sounds.items():
    path = os.path.join(output_dir, filename)
    print(f"Downloading {filename}...")
    try:
        download_file(url, path)
        size = os.path.getsize(path)
        print(f"  ✅ {filename} ({size:,} bytes)")
    except Exception as e:
        fallback_url = fallbacks.get(filename)
        if not fallback_url:
            print(f"  ❌ Failed: {e}")
            continue
        print(f"  ⚠️  Primary URL failed ({e}), trying fallback...")
        try:
            download_file(fallback_url, path)
            size = os.path.getsize(path)
            print(f"  ✅ {filename} ({size:,} bytes) [fallback]")
        except Exception as fallback_error:
            print(f"  ❌ Failed: {fallback_error}")

print("Done! Run the frontend to test sounds.")
