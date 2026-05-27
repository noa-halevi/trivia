# Trivia

## Sound files

Placeholder audio in `frontend/public/sounds/` is replaced with real Mixkit assets via a one-time download script.

```bash
# Download real sound files (run once, from repo root):
python scripts/download_sounds.py

# Then restart the frontend:
cd frontend && npm run dev
```

Click anywhere on the title screen (or press a key) to unlock audio in the browser; title music should start after that first interaction.
