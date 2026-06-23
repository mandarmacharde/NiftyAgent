from services.option_pricing import calc_option_price, select_strike, LOT_SIZE


def make_trade_decision(analysis, vix_context=None):
    bias = analysis["bias"]
    confidence = int(analysis["confidence"])
    momentum = float(analysis.get("momentum", 0))
    spot = float(analysis["last_price"])
    rsi = analysis.get("rsi")
    macd = analysis.get("macd", 0)
    macd_signal = analysis.get("macd_signal", 0)
    support = analysis.get("support")
    resistance = analysis.get("resistance")

    iv = 0.15
    if vix_context:
        iv = float(vix_context.get("vix", 15)) / 100.0

    if bias == "bullish" and confidence >= 60:
        action = "BUY_CALL"
        option_type = "CE"
        reason_parts = ["Bullish setup"]
        if rsi and rsi > 55:
            reason_parts.append(f"RSI={rsi:.0f}")
        if macd > macd_signal:
            reason_parts.append("MACD positive")
        if momentum > 0:
            reason_parts.append(f"momentum={momentum:+.2f}%")
        reason = "Call entry: " + ", ".join(reason_parts)

    elif bias == "bearish" and confidence >= 60:
        action = "BUY_PUT"
        option_type = "PE"
        reason_parts = ["Bearish setup"]
        if rsi and rsi < 45:
            reason_parts.append(f"RSI={rsi:.0f}")
        if macd < macd_signal:
            reason_parts.append("MACD negative")
        if momentum < 0:
            reason_parts.append(f"momentum={momentum:+.2f}%")
        reason = "Put entry: " + ", ".join(reason_parts)

    else:
        return {
            "action": "NO_TRADE",
            "confidence": confidence,
            "reason": "Neutral or low-confidence setup — no trade",
            "momentum": round(momentum, 2),
            "strike": None,
            "option_type": None,
            "entry_premium": None,
        }

    aggression = 0.5
    if confidence >= 75:
        aggression = 0.7
    elif confidence < 65:
        aggression = 0.3

    strike_info = select_strike(spot, iv, 1, bias, aggression)

    if not strike_info:
        return {
            "action": "NO_TRADE",
            "confidence": confidence,
            "reason": "Could not find suitable strike",
            "momentum": round(momentum, 2),
            "strike": None,
            "option_type": None,
            "entry_premium": None,
        }

    return {
        "action": action,
        "confidence": confidence,
        "reason": reason,
        "momentum": round(momentum, 2),
        "strike": strike_info["strike"],
        "option_type": option_type,
        "entry_premium": strike_info["premium"],
        "moneyness": strike_info["moneyness"],
        "lot_size": LOT_SIZE,
    }
