from datetime import datetime, timezone, timedelta
from calendar import timegm

import yfinance as yf


NIFTY_SYMBOL = "^NSEI"
VIX_SYMBOL = "^INDIAVIX"

TIMEFRAME_INTERVAL_MAP = {
    "1m": ("2d", "1m"),
    "5m": ("5d", "5m"),
    "15m": ("1mo", "15m"),
    "1h": ("1mo", "1h"),
    "1d": ("6mo", "1d"),
}


class MarketDataError(Exception):
    pass


def get_nifty_data():
    return get_market_snapshot(NIFTY_SYMBOL)


def get_chart_data(timeframe="1m"):
    ticker = yf.Ticker(NIFTY_SYMBOL)
    period, interval = TIMEFRAME_INTERVAL_MAP.get(timeframe, ("2d", "1m"))
    data = ticker.history(period=period, interval=interval)

    if data.empty:
        data = ticker.history(period="5d", interval="1m")

    if data.empty:
        raise MarketDataError("No chart data available")

    data = data.dropna(subset=["Close"])

    candles = []
    for timestamp, row in data.iterrows():
        candles.append({
            "time": timegm(timestamp.utctimetuple()),
            "open": _safe_float(row.get("Open")),
            "high": _safe_float(row.get("High")),
            "low": _safe_float(row.get("Low")),
            "close": _safe_float(row.get("Close")),
            "volume": int(row.get("Volume", 0) or 0),
        })

    latest = data.iloc[-1]
    current_day = data[data.index.date == data.index[-1].date()]
    previous = data.iloc[-2] if len(data) > 1 else latest
    prev_close = _safe_float(previous.get("Close"), latest["Close"])
    close = _safe_float(latest["Close"])
    high = _safe_float(current_day["High"].max(), latest["High"])
    low = _safe_float(current_day["Low"].min(), latest["Low"])
    change = close - prev_close
    change_percent = (change / prev_close) * 100 if prev_close else 0

    return {
        "candles": candles,
        "last_price": round(close, 2),
        "change": round(change, 2),
        "change_percent": round(change_percent, 2),
        "symbol": "NIFTY",
        "timeframe": timeframe,
        "count": len(candles),
        "first_time": candles[0]["time"] if candles else None,
        "last_time": candles[-1]["time"] if candles else None,
    }


def get_market_snapshot(symbol=NIFTY_SYMBOL):
    ticker = yf.Ticker(symbol)
    data = ticker.history(period="2d", interval="1m")

    if data.empty:
        data = ticker.history(period="5d", interval="1d")

    if data.empty:
        raise MarketDataError(f"No market data available for {symbol}")

    data = data.dropna(subset=["Close"])
    latest = data.iloc[-1]
    current_day = data[data.index.date == data.index[-1].date()]
    previous = data.iloc[-2] if len(data) > 1 else latest

    prev_close = _safe_float(previous.get("Close"), latest["Close"])
    close = _safe_float(latest["Close"])
    high = _safe_float(current_day["High"].max(), latest["High"])
    low = _safe_float(current_day["Low"].min(), latest["Low"])
    open_price = _safe_float(current_day["Open"].iloc[0], latest["Open"])
    change = close - prev_close
    change_percent = (change / prev_close) * 100 if prev_close else 0

    candles = []
    for timestamp, row in data.tail(390).iterrows():
        candles.append({
            "time": timegm(timestamp.utctimetuple()),
            "open": _safe_float(row.get("Open")),
            "high": _safe_float(row.get("High")),
            "low": _safe_float(row.get("Low")),
            "close": _safe_float(row.get("Close")),
            "volume": int(row.get("Volume", 0) or 0),
        })

    return {
        "symbol": "NIFTY",
        "source_symbol": symbol,
        "close": round(close, 2),
        "last_price": round(close, 2),
        "open": round(open_price, 2),
        "high": round(high, 2),
        "low": round(low, 2),
        "previous_close": round(prev_close, 2),
        "change": round(change, 2),
        "change_percent": round(change_percent, 2),
        "volume": int(latest.get("Volume", 0) or 0),
        "timestamp": data.index[-1].isoformat(),
        "server_time": datetime.now(timezone.utc).isoformat(),
        "candles": candles,
    }


def get_india_vix_data():
    vix = yf.Ticker(VIX_SYMBOL)
    data = vix.history(period="2d", interval="1m")

    if data.empty:
        data = vix.history(period="5d", interval="1d")

    if data.empty:
        raise MarketDataError("No India VIX data available")

    data = data.dropna(subset=["Close"])
    close = _safe_float(data["Close"].iloc[-1])
    previous = _safe_float(data["Close"].iloc[-2], close) if len(data) > 1 else close
    change = close - previous

    return {
        "vix": round(close, 2),
        "change": round(change, 2),
        "change_percent": round((change / previous) * 100, 2) if previous else 0,
        "timestamp": data.index[-1].isoformat(),
    }


def _safe_float(value, fallback=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(fallback)
