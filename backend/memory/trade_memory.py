import json
from pathlib import Path

MEMORY_FILE = "trade_history.json"

def save_trade(trade):

    if Path(MEMORY_FILE).exists():
        with open(MEMORY_FILE, "r") as f:
            data = json.load(f)
    else:
        data = []

    data.append(trade)

    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=4)