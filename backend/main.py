import asyncio
import random
from time import time
from calendar import timegm
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from services.market_data import get_chart_data, get_india_vix_data, get_nifty_data
from agents.market_agent import analyze_market
from agents.reflection_agent import reflect_trade
from agents.risk_agent import assess_trade_risk
from agents.trader_agent import make_trade_decision
from agents.vix_agent import analyze_vix
from memory.lesson_memory import (
    InvalidLessonDataError,
    get_best_and_worst_setup,
    get_lesson_performance,
    save_lesson,
)
from services.paper_broker import (
    EmptyTradeHistoryError,
    InvalidTradeDataError,
    MissingTradeHistoryError,
    NoOpenTradesError,
    TradeHistoryError,
    add_trade_reflection,
    auto_close_stops,
    close_trade as broker_close_trade,
    create_no_trade,
    create_trade,
    get_closed_trades,
    get_open_trades,
    get_trades as broker_get_trades,
    mark_open_trades,
)
from services.option_pricing import calc_option_price


app = FastAPI()

_last_tick = {"price": 0, "time": 0, "open": 0, "high": 0, "low": 0, "volume": 0}

TF_SECONDS = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400}

_last_market_state = None


def _is_market_open():
    now = datetime.now(IST)
    weekday = now.weekday()
    if weekday >= 5:
        return False
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return market_open <= now <= market_close


@app.get("/")
def root():
    return {"status": "running", "market_open": _is_market_open()}


@app.get("/market_status")
def market_status():
    now = datetime.now(IST)
    return {
        "market_open": _is_market_open(),
        "time_ist": now.strftime("%H:%M:%S"),
        "date_ist": now.strftime("%Y-%m-%d"),
        "weekday": now.strftime("%A"),
    }


@app.get("/nifty")
def nifty():
    try:
        return get_nifty_data()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to fetch NIFTY data") from exc


@app.get("/chart")
def chart(timeframe: str = Query("1m", pattern="^(1m|5m|15m|1h|1d)$")):
    try:
        return get_chart_data(timeframe)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to fetch chart data") from exc


@app.get("/tick")
def tick():
    try:
        return _build_market_state(mark_positions=True)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to fetch live market state") from exc


@app.get("/vix")
def vix():
    try:
        return analyze_vix(get_india_vix_data())
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to fetch VIX data") from exc


@app.get("/analysis")
def analysis():
    try:
        return _run_agents()
    except KeyError as exc:
        raise HTTPException(status_code=500, detail="Invalid market data") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to analyze NIFTY data") from exc


_chain_cache = {"iv": None, "expiry_dates": None, "expires_at": 0}


def _get_chain_meta():
    import time as _time
    now = _time.time()
    if _chain_cache["expiry_dates"] and now < _chain_cache["expires_at"]:
        return _chain_cache["iv"], _chain_cache["expiry_dates"]

    from datetime import datetime, timedelta
    from services.market_data import get_india_vix_data

    vix_data = get_india_vix_data()
    iv = (vix_data.get("vix", 15) or 15) / 100.0

    now_dt = datetime.utcnow()
    expiry_dates = []
    for i in range(4):
        d = now_dt + timedelta(days=i * 7 + 1)
        while d.weekday() >= 5:
            d += timedelta(days=1)
        expiry_dates.append(d.strftime("%d-%b-%Y"))

    _chain_cache["iv"] = iv
    _chain_cache["expiry_dates"] = expiry_dates
    _chain_cache["expires_at"] = now + 300
    return iv, expiry_dates


def _calc_chain(spot, iv, expiry_dates, selected_expiry):
    import math
    from datetime import datetime, timedelta

    RISK_FREE_RATE = 0.065
    now = datetime.utcnow()

    exp_dt = datetime.strptime(selected_expiry, "%d-%b-%Y")
    dte = max(1, (exp_dt - now).days)
    t = dte / 365.0
    sqrt_t = math.sqrt(t)

    def norm_cdf(x):
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    step = 50
    atm = round(spot / step) * step
    strikes = list(range(atm - 1000, atm + 1050, step))

    chain = []
    for strike in strikes:
        d1 = (math.log(spot / strike) + (RISK_FREE_RATE + 0.5 * iv * iv) * t) / (iv * sqrt_t)
        d2 = d1 - iv * sqrt_t
        nd1, nd2 = norm_cdf(d1), norm_cdf(d2)
        disc = math.exp(-RISK_FREE_RATE * t)

        ce_price = max(0, spot * nd1 - strike * disc * nd2)
        pe_price = max(0, strike * disc * (1 - nd2) - spot * (1 - nd1))

        dist = abs(strike - spot) / spot
        base_oi = max(50000, int(2000000 * math.exp(-dist * 30)))
        ce_oi = int(base_oi * (1.2 if strike > spot else 0.8))
        pe_oi = int(base_oi * (0.8 if strike > spot else 1.2))

        chain.append({
            "strike": strike,
            "ce": {
                "ltp": round(ce_price, 2),
                "change": round(ce_price * 0.05 * (1 if spot >= atm else -1), 2),
                "oi": ce_oi,
                "volume": int(ce_oi * 0.15),
                "iv": round(iv * 100, 2),
                "bid": round(max(0, ce_price - 0.5), 2),
                "ask": round(ce_price + 0.5, 2),
            },
            "pe": {
                "ltp": round(pe_price, 2),
                "change": round(pe_price * 0.05 * (1 if spot < atm else -1), 2),
                "oi": pe_oi,
                "volume": int(pe_oi * 0.12),
                "iv": round(iv * 100, 2),
                "bid": round(max(0, pe_price - 0.5), 2),
                "ask": round(pe_price + 0.5, 2),
            },
        })

    total_ce = sum(s["ce"]["oi"] for s in chain)
    total_pe = sum(s["pe"]["oi"] for s in chain)

    return {
        "spot": round(spot, 2),
        "expiry_dates": expiry_dates,
        "selected_expiry": selected_expiry,
        "days_to_expiry": dte,
        "strikes": chain,
        "total_ce_oi": total_ce,
        "total_pe_oi": total_pe,
        "pcr": round(total_pe / total_ce, 2) if total_ce else 0,
        "iv": round(iv * 100, 2),
        "source": "calculated",
    }


@app.get("/option_chain")
def option_chain(expiry: str = Query(None), spot: float = Query(None)):
    try:
        iv, expiry_dates = _get_chain_meta()

        if spot is None:
            from services.market_data import get_nifty_data
            market = get_nifty_data()
            spot = market["last_price"]

        selected_expiry = expiry or expiry_dates[0]
        return _calc_chain(spot, iv, expiry_dates, selected_expiry)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Option chain error: {exc}") from exc


@app.get("/trades")
def get_trades():
    try:
        return broker_get_trades()
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc


@app.post("/papertrade")
def paper_trade():
    try:
        market_analysis, vix_context, decision, risk = _run_agents(as_tuple=True)

        if not risk["trade_allowed"]:
            return create_no_trade(
                symbol="NIFTY",
                action=decision["action"],
                analysis=market_analysis,
                vix_context=vix_context,
                risk_context=risk
            )

        return create_trade(
            symbol="NIFTY",
            action=decision["action"],
            entry=risk["entry_premium"],
            analysis=market_analysis,
            vix_context=vix_context,
            risk_context=risk
        )
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc
    except KeyError as exc:
        raise HTTPException(status_code=500, detail="Invalid analysis data") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to create paper trade: {exc}") from exc


@app.post("/close_trade")
def close_trade():
    try:
        market_data = get_nifty_data()
        spot = market_data["last_price"]

        open_trades = get_open_trades()
        if not open_trades:
            raise NoOpenTradesError("No open trades available to close")

        last_trade = open_trades[-1]
        strike = last_trade.get("strike")
        option_type = last_trade.get("option_type")

        if strike and option_type:
            iv, _ = _get_chain_meta()
            exit_premium = calc_option_price(spot, float(strike), iv, 1, option_type)
        else:
            exit_premium = spot

        trade = broker_close_trade(exit_price=exit_premium, symbol="NIFTY")
        lesson = reflect_trade(trade)
        save_lesson(lesson)
        return add_trade_reflection(trade["_trade_index"], lesson)
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc
    except InvalidLessonDataError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/open_trades")
def open_trades():
    try:
        return get_open_trades()
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc


@app.get("/closed_trades")
def closed_trades():
    try:
        return get_closed_trades()
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc


@app.get("/reflect")
def reflect():
    try:
        trades = broker_get_trades()
        closed_trades = [trade for trade in trades if trade["status"] == "CLOSED"]
        if not closed_trades:
            raise NoOpenTradesError("No closed trades available for reflection")

        return reflect_trade(closed_trades[-1])
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc
    except KeyError as exc:
        raise HTTPException(status_code=500, detail="Invalid trade data") from exc


@app.get("/stats")
def stats():
    try:
        closed = get_closed_trades()
        best_setup, worst_setup = get_best_and_worst_setup()
    except TradeHistoryError as exc:
        raise _trade_history_exception(exc) from exc
    except InvalidLessonDataError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    wins = len([trade for trade in closed if trade["pnl"] > 0])
    losses = len([trade for trade in closed if trade["pnl"] <= 0])
    total_trades = len(closed)
    net_pnl = sum(trade["pnl"] for trade in closed)
    win_rate = round((wins / total_trades) * 100, 2) if total_trades else 0

    return {
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "net_pnl": net_pnl,
        "setup_performance": get_lesson_performance(),
        "best_performing_setup": best_setup,
        "worst_performing_setup": worst_setup
    }


@app.websocket("/ws/market")
async def market_socket(websocket: WebSocket):
    await websocket.accept()
    global _last_market_state
    try:
        while True:
            if _is_market_open():
                state = await asyncio.to_thread(_build_market_state, True)
                _last_market_state = state
            else:
                state = _last_market_state or await asyncio.to_thread(_build_market_state, False)
                state = {**state, "market_closed": True}

            await websocket.send_json(state)
            await asyncio.sleep(1 if _is_market_open() else 5)
    except WebSocketDisconnect:
        return


@app.websocket("/ws/chart")
async def chart_socket(websocket: WebSocket):
    await websocket.accept()
    tf = "1m"
    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                import json
                data = json.loads(msg)
                if "timeframe" in data:
                    tf = data["timeframe"]
                    chart_data = await asyncio.to_thread(get_chart_data, tf)
                    await websocket.send_json({
                        "type": "snapshot",
                        "candles": chart_data["candles"],
                        "last_price": chart_data["last_price"],
                        "change": chart_data["change"],
                        "change_percent": chart_data["change_percent"],
                        "timeframe": tf,
                        "first_time": chart_data["first_time"],
                        "last_time": chart_data["last_time"],
                        "market_closed": not _is_market_open(),
                    })
                    _init_tick(chart_data["last_price"])
                    continue
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass

            if not _is_market_open():
                await asyncio.sleep(5)
                continue

            tick_data = _simulate_tick(tf)
            await websocket.send_json({
                "type": "tick",
                "candle": tick_data["candle"],
                "last_price": tick_data["last_price"],
                "change": tick_data["change"],
                "change_percent": tick_data["change_percent"],
                "market_closed": False,
            })
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


def _init_tick(price):
    now = int(time())
    _last_tick.update({
        "price": float(price),
        "time": now,
        "open": float(price),
        "high": float(price),
        "low": float(price),
        "volume": random.randint(100, 500),
    })


def _simulate_tick(timeframe="1m"):
    if _last_tick["price"] == 0:
        try:
            data = get_chart_data(timeframe)
            _init_tick(data["last_price"])
        except Exception:
            _init_tick(25000)

    vol = _last_tick["price"] * 0.00008
    drift = random.gauss(0, vol)
    new_price = round(_last_tick["price"] + drift, 2)

    now = int(time())
    tf_sec = TF_SECONDS.get(timeframe, 60)
    candle_time = (now // tf_sec) * tf_sec

    if candle_time != (_last_tick.get("candle_time", 0)):
        _last_tick["open"] = new_price
        _last_tick["high"] = new_price
        _last_tick["low"] = new_price
        _last_tick["volume"] = random.randint(50, 300)
        _last_tick["candle_time"] = candle_time
    else:
        _last_tick["high"] = max(_last_tick["high"], new_price)
        _last_tick["low"] = min(_last_tick["low"], new_price)
        _last_tick["volume"] += random.randint(10, 50)

    _last_tick["price"] = new_price

    open_p = _last_tick["open"]
    high_p = _last_tick["high"]
    low_p = _last_tick["low"]
    close_p = new_price

    baseline = _last_tick.get("baseline_price", new_price)
    change = round(close_p - baseline, 2)
    change_pct = round((change / baseline) * 100, 2) if baseline else 0

    return {
        "candle": {
            "time": candle_time,
            "open": round(open_p, 2),
            "high": round(high_p, 2),
            "low": round(low_p, 2),
            "close": round(close_p, 2),
            "volume": _last_tick["volume"],
        },
        "last_price": round(close_p, 2),
        "change": change,
        "change_percent": change_pct,
    }


def _run_agents(as_tuple=False):
    market_data = get_nifty_data()
    market_analysis = analyze_market(market_data)
    vix_context = analyze_vix(get_india_vix_data())
    decision = make_trade_decision(market_analysis, vix_context)
    risk = assess_trade_risk(market_analysis, decision, vix_context, get_open_trades())

    if as_tuple:
        return market_analysis, vix_context, decision, risk

    return {
        **market_analysis,
        "vix_context": vix_context,
        "trade_decision": decision,
        "risk": risk,
    }


def _build_market_state(mark_positions=False):
    analysis = _run_agents()
    spot = analysis["last_price"]

    iv = None
    try:
        iv_data = analysis.get("vix_context", {})
        iv = iv_data.get("vix")
    except Exception:
        pass

    if mark_positions:
        auto_close_stops(spot, iv or 15)
        open_trades = mark_open_trades(spot, iv)
    else:
        open_trades = get_open_trades()

    return {
        "analysis": analysis,
        "open_trades": open_trades,
        "closed_trades": get_closed_trades(),
        "stats": _calculate_stats(),
    }


def _calculate_stats():
    closed = get_closed_trades()
    wins = len([trade for trade in closed if trade["pnl"] > 0])
    losses = len([trade for trade in closed if trade["pnl"] <= 0])
    total_trades = len(closed)
    realized_pnl = round(sum(trade["pnl"] for trade in closed), 2)
    open_pnl = round(sum((trade.get("unrealized_pnl") or 0) for trade in get_open_trades()), 2)

    return {
        "total_trades": total_trades,
        "wins": wins,
        "losses": losses,
        "win_rate": round((wins / total_trades) * 100, 2) if total_trades else 0,
        "realized_pnl": realized_pnl,
        "open_pnl": open_pnl,
        "net_pnl": round(realized_pnl + open_pnl, 2),
    }


def _trade_history_exception(exc):
    if isinstance(exc, MissingTradeHistoryError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, EmptyTradeHistoryError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, NoOpenTradesError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, InvalidTradeDataError):
        return HTTPException(status_code=500, detail=str(exc))

    return HTTPException(status_code=500, detail="Trade history error")
