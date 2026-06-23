from services.option_pricing import LOT_SIZE

MAX_OPEN_TRADES = 3
STOP_LOSS_PCT = 0.30
TARGET_PCT = 0.50
MIN_PREMIUM = 10.0


def assess_trade_risk(analysis, trade_decision, vix_context, open_trades=None):
    confidence = int(analysis.get("confidence", 0))
    action = trade_decision["action"]
    entry_premium = trade_decision.get("entry_premium")
    strike = trade_decision.get("strike")
    option_type = trade_decision.get("option_type")
    risk_multiplier = float(vix_context.get("risk_multiplier", 1.0))
    market_volatility = vix_context.get("market_volatility", "NORMAL")
    spot = float(analysis.get("last_price", 0))
    open_trades = open_trades or []

    if action == "NO_TRADE" or confidence < 55:
        return _blocked("Low confidence or neutral signal")

    if not entry_premium or entry_premium < MIN_PREMIUM:
        return _blocked(f"Premium too low (min ₹{MIN_PREMIUM})")

    if len(open_trades) >= MAX_OPEN_TRADES:
        return _blocked(f"Max {MAX_OPEN_TRADES} open trades reached")

    for t in open_trades:
        if t.get("strike") == strike and t.get("option_type") == option_type:
            return _blocked(f"Already holding {option_type} at {strike}")

    base_lots = 1
    if confidence >= 80 and market_volatility == "LOW":
        base_lots = 2
    elif confidence < 65 or market_volatility == "HIGH":
        base_lots = 1

    lots = max(1, int(base_lots * risk_multiplier))
    quantity = lots * LOT_SIZE

    stop_loss_premium = round(entry_premium * (1 - STOP_LOSS_PCT), 2)
    target_premium = round(entry_premium * (1 + TARGET_PCT), 2)

    max_risk = round((entry_premium - stop_loss_premium) * quantity, 2)
    max_reward = round((target_premium - entry_premium) * quantity, 2)
    risk_reward = round(max_reward / max_risk, 2) if max_risk > 0 else 0

    risk_score = round((confidence / 100) * risk_multiplier * (1 if market_volatility == "LOW" else 0.8), 2)

    return {
        "trade_allowed": True,
        "position_size": quantity,
        "lots": lots,
        "lot_size": LOT_SIZE,
        "max_risk": max_risk,
        "max_reward": max_reward,
        "risk_reward": risk_reward,
        "risk_score": risk_score,
        "stop_loss": stop_loss_premium,
        "target": target_premium,
        "strike": strike,
        "option_type": option_type,
        "entry_premium": entry_premium,
        "reason": f"Trade allowed — {lots} lot(s), SL ₹{stop_loss_premium}, TGT ₹{target_premium}",
        "block_reason": None,
    }


def assess_exit(trade, current_premium):
    entry = float(trade.get("entry", 0))
    stop_loss = trade.get("stop_loss")
    target = trade.get("target")

    if not stop_loss or not target:
        return {"should_exit": False, "reason": None}

    if current_premium <= float(stop_loss):
        return {"should_exit": True, "reason": "stop_loss", "exit_price": current_premium}

    if current_premium >= float(target):
        return {"should_exit": True, "reason": "target", "exit_price": current_premium}

    pnl_pct = (current_premium - entry) / entry if entry else 0
    if pnl_pct <= -0.50:
        return {"should_exit": True, "reason": "max_loss", "exit_price": current_premium}

    return {"should_exit": False, "reason": None}


def _blocked(reason):
    return {
        "trade_allowed": False,
        "position_size": 0,
        "lots": 0,
        "lot_size": LOT_SIZE,
        "max_risk": 0,
        "max_reward": 0,
        "risk_reward": 0,
        "risk_score": 0,
        "stop_loss": None,
        "target": None,
        "strike": None,
        "option_type": None,
        "entry_premium": None,
        "reason": "NO TRADE",
        "block_reason": reason,
    }
