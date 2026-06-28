# NiftyAgent

AI-powered paper trading system for the Indian stock market (NIFTY 50). A multi-agent architecture where five specialized agents collaboratively analyze live market data, assess risk, make trade decisions, and learn from outcomes — all without using real money.

## Features

- **Multi-Agent Pipeline** — Five agents (Market, VIX, Trader, Risk, Reflection) analyze data and make decisions
- **Live Market Data** — Real-time NIFTY 50 and India VIX data via Yahoo Finance
- **Paper Trading** — Simulated broker with full trade lifecycle (entry, stop-loss, target, exit)
- **Risk Management** — Automatic stop-loss, target hits, position sizing based on VIX volatility
- **Real-Time Dashboard** — WebSocket-powered live updates, charts, and agent analysis cards
- **Post-Trade Reflection** — Lessons are stored and learned from for future decisions
- **IST Timezone** — All timestamps displayed in India Standard Time

## Tech Stack

### Backend
- **Python 3.11+** with FastAPI
- **yfinance** for live NIFTY 50 / VIX data
- **uvicorn** ASGI server
- **pandas / numpy** for data processing

### Frontend
- **React 18** with Vite
- **Tailwind CSS** (dark theme)
- **TradingView Lightweight Charts** for price charts
- **Lucide React** for icons
- **WebSocket** for real-time market feed

## Project Structure

```
NiftyAgent/
├── backend/
│   ├── main.py                  # FastAPI app, endpoints, WebSocket
│   ├── models.py                # Trade data model
│   ├── agents/
│   │   ├── market_agent.py      # Technical analysis (SMA, RSI, MACD)
│   │   ├── vix_agent.py         # Volatility classification
│   │   ├── trader_agent.py      # BUY_CALL / BUY_PUT decisions
│   │   ├── risk_agent.py        # Position sizing, stop-loss, target
│   │   └── reflection_agent.py  # Post-trade lesson generation
│   ├── services/
│   │   ├── market_data.py       # Yahoo Finance data fetcher
│   │   ├── option_pricing.py    # Black-Scholes option pricing
│   │   └── paper_broker.py      # Paper trade execution & persistence
│   └── memory/
│       ├── lesson_memory.py     # Lesson storage & analytics
│       └── trade_memory.py      # Trade persistence
└── frontend/
    ├── src/
    │   ├── App.jsx              # Router (Dashboard, Market, Trades, History)
    │   ├── api/client.js        # REST & WebSocket API client
    │   ├── components/
    │   │   ├── Layout.jsx       # Sidebar navigation
    │   │   ├── LiveChart.jsx    # TradingView chart
    │   │   ├── PriceTicker.jsx  # Live price ticker
    │   │   ├── TradeTable.jsx   # Trade data table
    │   │   ├── OptionsChain.jsx # Options chain display
    │   │   └── StatCard.jsx     # Reusable stat card
    │   ├── pages/
    │   │   ├── Dashboard.jsx    # Overview + quick actions + analysis
    │   │   ├── Market.jsx       # Live analysis + agent cards
    │   │   ├── Trades.jsx       # Trade history with filters
    │   │   └── History.jsx      # Closed trades + reflections
    │   └── utils/
    │       └── time.js          # IST timezone formatters
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r ../requirements.txt

# Start server
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173` (proxies `/api` to backend)

### Access
Open `http://localhost:5173` in your browser.

## How It Works

1. **Market Data** — yfinance fetches live NIFTY 50 candles and India VIX
2. **Analysis** — Market agent scores 7 technical indicators (SMA crossover, RSI, MACD, range position, momentum, wick analysis) to determine bullish/bearish bias
3. **VIX Assessment** — Classifies volatility as LOW/NORMAL/HIGH, adjusting risk multiplier
4. **Trade Decision** — Trader agent maps bias + confidence to BUY_CALL (CE) or BUY_PUT (PE)
5. **Risk Gate** — Risk agent checks position limits, calculates stop-loss (30% below entry), target (50% above entry), and lot size
6. **Execution** — Paper broker creates the trade with Black-Scholes option pricing
7. **Auto-Close** — On every tick, `auto_close_stops()` checks stop-loss, target, and max-loss conditions
8. **Reflection** — Closed trades are analyzed for lessons (success/failure classification)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tick` | Full market state snapshot |
| GET | `/analysis` | Run all agents, return combined analysis |
| GET | `/nifty` | Raw NIFTY market data |
| GET | `/vix` | VIX analysis |
| POST | `/papertrade` | Execute a paper trade |
| POST | `/close_trade` | Close latest open trade |
| GET | `/trades` | All trades |
| GET | `/open_trades` | Open positions |
| GET | `/closed_trades` | Closed positions |
| GET | `/stats` | Performance statistics |
| WS | `/ws/market` | Real-time market feed (5s interval) |

## Configuration

All parameters are hardcoded (no config files yet):

| Parameter | Value | Location |
|-----------|-------|----------|
| Lot size | 75 | `option_pricing.py` |
| Stop loss | 30% below entry | `risk_agent.py` |
| Target | 50% above entry | `risk_agent.py` |
| Max open trades | 3 | `risk_agent.py` |
| Min premium | Rs. 10 | `risk_agent.py` |
| Confidence threshold | 60% | `trader_agent.py` |
