import math
from datetime import datetime, timedelta

RISK_FREE_RATE = 0.065
LOT_SIZE = 75


def norm_cdf(x):
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def calc_option_price(spot, strike, iv, dte, option_type="CE"):
    if spot <= 0 or strike <= 0 or iv <= 0 or dte <= 0:
        return 0.0

    t = dte / 365.0
    sqrt_t = math.sqrt(t)
    d1 = (math.log(spot / strike) + (RISK_FREE_RATE + 0.5 * iv * iv) * t) / (iv * sqrt_t)
    d2 = d1 - iv * sqrt_t
    disc = math.exp(-RISK_FREE_RATE * t)

    if option_type == "CE":
        return max(0, spot * norm_cdf(d1) - strike * disc * norm_cdf(d2))
    else:
        return max(0, strike * disc * (1 - norm_cdf(d2)) - spot * (1 - norm_cdf(d1)))


def calc_greeks(spot, strike, iv, dte, option_type="CE"):
    if spot <= 0 or strike <= 0 or iv <= 0 or dte <= 0:
        return {"delta": 0, "gamma": 0, "theta": 0, "vega": 0}

    t = dte / 365.0
    sqrt_t = math.sqrt(t)
    d1 = (math.log(spot / strike) + (RISK_FREE_RATE + 0.5 * iv * iv) * t) / (iv * sqrt_t)
    d2 = d1 - iv * sqrt_t
    disc = math.exp(-RISK_FREE_RATE * t)
    nd1 = norm_cdf(d1)
    pdf_d1 = math.exp(-0.5 * d1 * d1) / math.sqrt(2 * math.pi)

    gamma = pdf_d1 / (spot * iv * sqrt_t)
    vega = spot * pdf_d1 * sqrt_t / 100
    theta_factor = -(spot * pdf_d1 * iv) / (2 * sqrt_t)

    if option_type == "CE":
        delta = nd1
        theta = (theta_factor - RISK_FREE_RATE * strike * disc * norm_cdf(d2)) / 365
    else:
        delta = nd1 - 1
        theta = (theta_factor + RISK_FREE_RATE * strike * disc * (1 - norm_cdf(d2))) / 365

    return {
        "delta": round(delta, 4),
        "gamma": round(gamma, 4),
        "theta": round(theta, 4),
        "vega": round(vega, 4),
    }


def select_strike(spot, iv, dte, bias, aggression=0.5):
    strikes = []
    step = 50
    atm = round(spot / step) * step

    for offset in range(-200, 250, step):
        strike = atm + offset
        if strike <= 0:
            continue
        option_type = "CE" if bias == "bullish" else "PE"
        premium = calc_option_price(spot, strike, iv, dte, option_type)
        moneyness = abs(strike - spot) / spot

        if bias == "bullish":
            if option_type == "CE":
                otm = strike > spot
            else:
                otm = strike < spot
        else:
            if option_type == "PE":
                otm = strike < spot
            else:
                otm = strike > spot

        strikes.append({
            "strike": strike,
            "type": option_type,
            "premium": round(premium, 2),
            "moneyness": round(moneyness * 100, 2),
            "otm": otm,
        })

    if bias == "bullish":
        candidates = [s for s in strikes if s["type"] == "CE" and s["premium"] > 5]
        candidates.sort(key=lambda s: (0 if s["strike"] == atm else 1, abs(s["strike"] - spot)))
    else:
        candidates = [s for s in strikes if s["type"] == "PE" and s["premium"] > 5]
        candidates.sort(key=lambda s: (0 if s["strike"] == atm else 1, abs(s["strike"] - spot)))

    if not candidates:
        candidates = [s for s in strikes if s["premium"] > 2]
        candidates.sort(key=lambda s: s["premium"])

    if not candidates:
        return strikes[0] if strikes else None

    idx = min(int(aggression * len(candidates)), len(candidates) - 1)
    return candidates[idx]


def estimate_pnl(entry_premium, exit_premium, option_type, quantity):
    if option_type in ("BUY_CALL", "BUY_PUT"):
        return round((exit_premium - entry_premium) * quantity, 2)
    else:
        return round((entry_premium - exit_premium) * quantity, 2)
