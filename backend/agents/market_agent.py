def analyze_market(data):
    close = float(data.get("close") or data.get("last_price", 0))
    high = float(data.get("high") or data.get("last_price", close))
    low = float(data.get("low") or data.get("last_price", close))
    open_price = float(data.get("open", close))
    previous_close = float(data.get("previous_close", close))
    candles = data.get("candles", [])

    range_size = max(high - low, 0.01)
    range_position = ((close - low) / range_size) * 100
    change_percent = float(data.get("change_percent", 0))

    sma_5 = _sma(candles, 5) or close
    sma_20 = _sma(candles, 20) or close
    ema_12 = _ema(candles, 12) or close
    ema_26 = _ema(candles, 26) or close

    momentum = ((close - previous_close) / previous_close) * 100 if previous_close else 0

    rsi = _rsi(candles, 14)
    macd_line = ema_12 - ema_26
    signal_line = _ema_from_values([ema_12 - ema_26 for _ in range(min(9, len(candles)))], 9) or macd_line

    support = _find_support(candles, close)
    resistance = _find_resistance(candles, close)

    body = abs(close - open_price)
    upper_wick = high - max(close, open_price)
    lower_wick = min(close, open_price) - low

    score = 0
    reasons = []

    if close > sma_5:
        score += 1
        reasons.append("above SMA5")
    else:
        score -= 1
        reasons.append("below SMA5")

    if sma_5 > sma_20:
        score += 1
        reasons.append("SMA5 > SMA20")
    else:
        score -= 1
        reasons.append("SMA5 < SMA20")

    if change_percent > 0:
        score += 1
        reasons.append("positive change")
    else:
        score -= 1
        reasons.append("negative change")

    if range_position >= 65:
        score += 1
        reasons.append("strong range position")
    elif range_position <= 35:
        score -= 1
        reasons.append("weak range position")

    if rsi and rsi > 55:
        score += 1
        reasons.append(f"RSI bullish ({rsi:.0f})")
    elif rsi and rsi < 45:
        score -= 1
        reasons.append(f"RSI bearish ({rsi:.0f})")

    if macd_line > signal_line:
        score += 1
        reasons.append("MACD bullish")
    else:
        score -= 1
        reasons.append("MACD bearish")

    if lower_wick > body * 2 and close > open_price:
        score += 1
        reasons.append("bullish rejection wick")
    elif upper_wick > body * 2 and close < open_price:
        score -= 1
        reasons.append("bearish rejection wick")

    if score >= 3:
        bias = "bullish"
        confidence = min(90, 55 + (score * 5) + abs(momentum * 1.5))
        reason = "Bullish: " + ", ".join(reasons[:3])
    elif score <= -3:
        bias = "bearish"
        confidence = min(90, 55 + (abs(score) * 5) + abs(momentum * 1.5))
        reason = "Bearish: " + ", ".join(reasons[:3])
    else:
        bias = "neutral"
        confidence = 40 + min(15, abs(momentum * 2))
        reason = "Mixed signals: " + ", ".join(reasons[:3])

    return {
        **data,
        "bias": bias,
        "confidence": round(confidence),
        "reason": reason,
        "range_position": round(range_position, 2),
        "momentum": round(momentum, 2),
        "sma_5": round(sma_5, 2),
        "sma_20": round(sma_20, 2),
        "rsi": round(rsi, 2) if rsi else None,
        "macd": round(macd_line, 2),
        "macd_signal": round(signal_line, 2),
        "support": round(support, 2) if support else None,
        "resistance": round(resistance, 2) if resistance else None,
        "signal_score": score,
    }


def _sma(candles, period):
    closes = [float(c["close"]) for c in candles[-period:] if c.get("close") is not None]
    return sum(closes) / len(closes) if len(closes) >= period else None


def _ema(candles, period):
    closes = [float(c["close"]) for c in candles[-period * 2:] if c.get("close") is not None]
    if len(closes) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    for price in closes[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def _ema_from_values(values, period):
    if len(values) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    for val in values[period:]:
        ema = (val - ema) * multiplier + ema
    return ema


def _rsi(candles, period=14):
    if len(candles) < period + 1:
        return None

    closes = [float(c["close"]) for c in candles[-(period + 1):] if c.get("close") is not None]
    if len(closes) < period + 1:
        return None

    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(0, diff))
        losses.append(max(0, -diff))

    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period

    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _find_support(candles, current_price):
    lows = [float(c["low"]) for c in candles[-50:] if c.get("low") is not None]
    below = sorted([l for l in lows if l < current_price], reverse=True)
    return below[0] if below else min(lows) if lows else None


def _find_resistance(candles, current_price):
    highs = [float(c["high"]) for c in candles[-50:] if c.get("high") is not None]
    above = sorted([h for h in highs if h > current_price])
    return above[0] if above else max(highs) if highs else None
