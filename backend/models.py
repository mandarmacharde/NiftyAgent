from dataclasses import asdict, dataclass
from typing import Optional


@dataclass
class Trade:
    id: str
    symbol: str
    action: str
    entry: float
    exit: Optional[float]
    pnl: Optional[float]
    bias: str
    confidence: int
    reason: str
    status: str
    created_at: str
    closed_at: Optional[str]
    vix: Optional[float]
    position_size: int
    risk_score: float
    stop_loss: Optional[float]
    target: Optional[float]
    last_price: Optional[float]
    unrealized_pnl: Optional[float]
    reflection: Optional[dict]
    strike: Optional[float] = None
    option_type: Optional[str] = None
    lot_size: int = 75
    lots: int = 1
    entry_premium: Optional[float] = None
    spot_at_entry: Optional[float] = None
    max_risk: Optional[float] = None
    max_reward: Optional[float] = None
    risk_reward: Optional[float] = None

    def to_dict(self):
        return asdict(self)
