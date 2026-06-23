def reflect_trade(trade):
    bias = trade.get("bias", "unknown")
    confidence = trade.get("confidence", 0)
    pnl = trade.get("pnl", 0) or 0
    action = trade.get("action", "unknown")
    option_type = trade.get("option_type", "")
    strike = trade.get("strike")
    entry = trade.get("entry", 0) or 0
    exit_price = trade.get("exit", 0) or 0
    stop_loss = trade.get("stop_loss")
    target = trade.get("target")
    vix = trade.get("vix")

    result = "success" if pnl > 0 else "failure"

    pnl_pct = ((exit_price - entry) / entry * 100) if entry else 0

    if exit_price and stop_loss and exit_price <= float(stop_loss):
        exit_reason = "stop_loss"
    elif exit_price and target and exit_price >= float(target):
        exit_reason = "target"
    else:
        exit_reason = "manual"

    vol_regime = "low"
    if vix:
        if vix > 20:
            vol_regime = "high"
        elif vix > 15:
            vol_regime = "medium"

    lesson = {
        "lesson_type": _lesson_type(bias, action, option_type),
        "result": result,
        "confidence": confidence,
        "pnl": pnl,
        "pnl_pct": round(pnl_pct, 2),
        "option_type": option_type,
        "strike": strike,
        "entry_premium": entry,
        "exit_premium": exit_price,
        "exit_reason": exit_reason,
        "volatility_regime": vol_regime,
        "vix": vix,
        "bias_correct": _bias_correct(bias, action, pnl),
    }

    return lesson


def _lesson_type(bias, action, option_type):
    parts = []
    if bias == "bullish":
        parts.append("bullish_call")
    elif bias == "bearish":
        parts.append("bearish_put")
    elif bias == "neutral":
        parts.append("neutral_trade")
    else:
        parts.append(f"unknown_{action.lower()}")

    if option_type:
        parts.append(option_type)

    return "_".join(parts)


def _bias_correct(bias, action, pnl):
    if pnl > 0:
        if (bias == "bullish" and "CALL" in action) or (bias == "bearish" and "PUT" in action):
            return True
        return False
    else:
        if (bias == "bullish" and "CALL" in action) or (bias == "bearish" and "PUT" in action):
            return False
        return True
