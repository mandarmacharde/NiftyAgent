import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from models import Trade
from services.option_pricing import calc_option_price, LOT_SIZE


TRADE_HISTORY_FILE = Path(__file__).resolve().parents[1] / "trade_history.json"
VALID_STATUSES = {"OPEN", "CLOSED"}


class TradeHistoryError(Exception):
    pass


class MissingTradeHistoryError(TradeHistoryError):
    pass


class EmptyTradeHistoryError(TradeHistoryError):
    pass


class NoOpenTradesError(TradeHistoryError):
    pass


class InvalidTradeDataError(TradeHistoryError):
    pass


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _read_trades(create_if_missing=False):
    if not TRADE_HISTORY_FILE.exists():
        if create_if_missing:
            return []
        raise MissingTradeHistoryError("trade_history.json not found")

    try:
        with TRADE_HISTORY_FILE.open("r", encoding="utf-8") as file:
            trades = json.load(file)
    except json.JSONDecodeError as exc:
        raise InvalidTradeDataError("trade_history.json contains invalid JSON") from exc

    if not isinstance(trades, list):
        raise InvalidTradeDataError("trade_history.json must contain a list of trades")

    return [_normalize_trade(trade) for trade in trades]


def _write_trades(trades):
    TRADE_HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    with TRADE_HISTORY_FILE.open("w", encoding="utf-8") as file:
        json.dump(trades, file, indent=4)


def _normalize_trade(trade):
    if not isinstance(trade, dict):
        raise InvalidTradeDataError("Each trade must be an object")

    if "symbol" not in trade or "action" not in trade or "entry" not in trade:
        raise InvalidTradeDataError("Trade is missing symbol, action, or entry")

    status = str(trade.get("status", "OPEN")).upper()
    if status not in VALID_STATUSES:
        raise InvalidTradeDataError("Trade status must be OPEN or CLOSED")

    return {
        "id": str(trade.get("id", uuid4())),
        "symbol": str(trade["symbol"]),
        "action": str(trade["action"]),
        "entry": _optional_float(trade["entry"], "entry", allow_none=False),
        "exit": _optional_float(trade.get("exit"), "exit"),
        "pnl": _optional_float(trade.get("pnl"), "pnl"),
        "bias": str(trade.get("bias", "unknown")),
        "confidence": _optional_int(trade.get("confidence", 0), "confidence"),
        "reason": str(trade.get("reason", "")),
        "status": status,
        "created_at": str(trade.get("created_at", "")),
        "closed_at": trade.get("closed_at"),
        "vix": _optional_float(trade.get("vix"), "vix"),
        "position_size": _optional_int(trade.get("position_size", LOT_SIZE), "position_size"),
        "risk_score": _optional_float(trade.get("risk_score", 0), "risk_score", allow_none=False),
        "stop_loss": _optional_float(trade.get("stop_loss"), "stop_loss"),
        "target": _optional_float(trade.get("target"), "target"),
        "last_price": _optional_float(trade.get("last_price"), "last_price"),
        "unrealized_pnl": _optional_float(trade.get("unrealized_pnl"), "unrealized_pnl"),
        "reflection": trade.get("reflection"),
        "strike": _optional_float(trade.get("strike"), "strike"),
        "option_type": trade.get("option_type"),
        "lot_size": _optional_int(trade.get("lot_size", LOT_SIZE), "lot_size"),
        "lots": _optional_int(trade.get("lots", 1), "lots"),
        "entry_premium": _optional_float(trade.get("entry_premium"), "entry_premium"),
        "spot_at_entry": _optional_float(trade.get("spot_at_entry"), "spot_at_entry"),
        "max_risk": _optional_float(trade.get("max_risk"), "max_risk"),
        "max_reward": _optional_float(trade.get("max_reward"), "max_reward"),
        "risk_reward": _optional_float(trade.get("risk_reward"), "risk_reward"),
    }


def _optional_float(value, field_name, allow_none=True):
    if value is None:
        if allow_none:
            return None
        raise InvalidTradeDataError(f"Trade {field_name} is required")

    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise InvalidTradeDataError(f"Trade {field_name} must be numeric") from exc


def _optional_int(value, field_name):
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise InvalidTradeDataError(f"Trade {field_name} must be numeric") from exc


def _require_history():
    trades = _read_trades()
    if not trades:
        raise EmptyTradeHistoryError("Trade history is empty")
    return trades


def create_trade(symbol, action, entry, analysis, vix_context=None, risk_context=None):
    if not isinstance(analysis, dict):
        raise InvalidTradeDataError("Analysis must be an object")

    for field in ("bias", "confidence", "reason"):
        if field not in analysis:
            raise InvalidTradeDataError(f"Analysis is missing {field}")

    strike = risk_context.get("strike") if risk_context else None
    option_type = risk_context.get("option_type") if risk_context else None
    entry_premium = risk_context.get("entry_premium") if risk_context else float(entry)
    spot_at_entry = float(analysis.get("last_price", entry))

    trade = Trade(
        id=str(uuid4()),
        symbol=symbol,
        action=action,
        entry=float(entry_premium),
        exit=None,
        pnl=None,
        bias=str(analysis["bias"]),
        confidence=int(analysis["confidence"]),
        reason=str(analysis["reason"]),
        status="OPEN",
        created_at=_utc_now(),
        closed_at=None,
        vix=vix_context["vix"] if vix_context else None,
        position_size=risk_context["position_size"] if risk_context else LOT_SIZE,
        risk_score=risk_context["risk_score"] if risk_context else 0,
        stop_loss=risk_context.get("stop_loss") if risk_context else None,
        target=risk_context.get("target") if risk_context else None,
        last_price=float(entry_premium),
        unrealized_pnl=0,
        reflection=None,
        strike=strike,
        option_type=option_type,
        lot_size=risk_context.get("lot_size", LOT_SIZE) if risk_context else LOT_SIZE,
        lots=risk_context.get("lots", 1) if risk_context else 1,
        entry_premium=float(entry_premium),
        spot_at_entry=spot_at_entry,
        max_risk=risk_context.get("max_risk") if risk_context else None,
        max_reward=risk_context.get("max_reward") if risk_context else None,
        risk_reward=risk_context.get("risk_reward") if risk_context else None,
    ).to_dict()

    trades = _read_trades(create_if_missing=True)
    trades.append(trade)
    _write_trades(trades)

    return trade


def create_no_trade(symbol, action, analysis, vix_context, risk_context):
    return {
        "symbol": symbol,
        "action": action,
        "trade_allowed": False,
        "bias": analysis["bias"],
        "confidence": analysis["confidence"],
        "reason": risk_context["reason"],
        "vix": vix_context["vix"],
        "market_volatility": vix_context["market_volatility"],
        "position_size": risk_context["position_size"],
        "max_risk": risk_context["max_risk"],
        "risk_score": risk_context["risk_score"],
        "block_reason": risk_context.get("block_reason"),
    }


def close_trade(exit_price, symbol=None):
    trades = _require_history()
    open_indexes = [
        index for index, trade in enumerate(trades)
        if trade["status"] == "OPEN" and (symbol is None or trade["symbol"] == symbol)
    ]

    if not open_indexes:
        raise NoOpenTradesError("No open trades available to close")

    trade_idx = open_indexes[-1]
    trade = trades[trade_idx]

    exit_premium = float(exit_price)
    entry_premium = float(trade["entry"])
    quantity = int(trade.get("position_size", LOT_SIZE))

    if trade["action"] in ("BUY_CALL", "BUY_PUT"):
        pnl = round((exit_premium - entry_premium) * quantity, 2)
    else:
        pnl = round((entry_premium - exit_premium) * quantity, 2)

    trade["exit"] = exit_premium
    trade["last_price"] = exit_premium
    trade["unrealized_pnl"] = 0
    trade["pnl"] = pnl
    trade["status"] = "CLOSED"
    trade["closed_at"] = _utc_now()

    _write_trades(trades)

    return {
        **trade,
        "_trade_index": trade_idx
    }


def auto_close_stops(spot, iv, dte=1):
    trades = _read_trades(create_if_missing=True)
    closed = []

    for i, trade in enumerate(trades):
        if trade["status"] != "OPEN":
            continue

        strike = trade.get("strike")
        option_type = trade.get("option_type")
        if not strike or not option_type:
            continue

        current_premium = calc_option_price(
            spot, float(strike), iv / 100.0 if iv > 1 else iv, dte, option_type
        )

        trade["last_price"] = round(current_premium, 2)
        entry = float(trade["entry"])
        quantity = int(trade.get("position_size", LOT_SIZE))

        if trade["action"] in ("BUY_CALL", "BUY_PUT"):
            trade["unrealized_pnl"] = round((current_premium - entry) * quantity, 2)
        else:
            trade["unrealized_pnl"] = round((entry - current_premium) * quantity, 2)

        stop_loss = trade.get("stop_loss")
        target = trade.get("target")

        should_close = False
        close_reason = None

        if stop_loss and current_premium <= float(stop_loss):
            should_close = True
            close_reason = "stop_loss"
        elif target and current_premium >= float(target):
            should_close = True
            close_reason = "target"
        elif trade["unrealized_pnl"] < 0 and abs(trade["unrealized_pnl"]) > entry * quantity * 0.5:
            should_close = True
            close_reason = "max_loss"

        if should_close:
            if trade["action"] in ("BUY_CALL", "BUY_PUT"):
                trade["pnl"] = round((current_premium - entry) * quantity, 2)
            else:
                trade["pnl"] = round((entry - current_premium) * quantity, 2)
            trade["exit"] = round(current_premium, 2)
            trade["status"] = "CLOSED"
            trade["closed_at"] = _utc_now()
            trade["unrealized_pnl"] = 0
            closed.append({"trade": trade, "reason": close_reason})

    if closed:
        _write_trades(trades)

    return closed


def add_trade_reflection(trade_index, reflection):
    trades = _require_history()

    if trade_index < 0 or trade_index >= len(trades):
        raise InvalidTradeDataError("Closed trade could not be found for reflection")

    trade = trades[trade_index]
    trade["reflection"] = reflection
    _write_trades(trades)

    return trade


def get_trades():
    return _read_trades(create_if_missing=True)


def get_open_trades():
    trades = _read_trades(create_if_missing=True)
    return [trade for trade in trades if trade["status"] == "OPEN"]


def get_closed_trades():
    trades = _read_trades(create_if_missing=True)
    return [trade for trade in trades if trade["status"] == "CLOSED"]


def mark_open_trades(spot, iv=None, dte=1):
    trades = _read_trades(create_if_missing=True)
    changed = False

    for trade in trades:
        if trade["status"] != "OPEN":
            continue

        strike = trade.get("strike")
        option_type = trade.get("option_type")

        if strike and option_type and iv is not None:
            iv_val = iv / 100.0 if iv > 1 else iv
            current_premium = calc_option_price(
                spot, float(strike), iv_val, dte, option_type
            )
            trade["last_price"] = round(current_premium, 2)

            entry = float(trade["entry"])
            quantity = int(trade.get("position_size", LOT_SIZE))
            if trade["action"] in ("BUY_CALL", "BUY_PUT"):
                trade["unrealized_pnl"] = round((current_premium - entry) * quantity, 2)
            else:
                trade["unrealized_pnl"] = round((entry - current_premium) * quantity, 2)
        else:
            trade["last_price"] = float(spot)
            trade["unrealized_pnl"] = _calculate_pnl(trade, spot)

        changed = True

    if changed:
        _write_trades(trades)

    return [trade for trade in trades if trade["status"] == "OPEN"]


def _calculate_pnl(trade, price):
    quantity = int(trade.get("position_size", 1) or 1)
    entry = float(trade["entry"])
    price = float(price)

    if trade["action"] == "BUY_PUT":
        pnl = entry - price
    else:
        pnl = price - entry

    return round(pnl * quantity, 2)
