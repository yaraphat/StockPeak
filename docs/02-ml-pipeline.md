# StockNow — ML Pipeline

## Overview

```
DSE OHLCV data (raw)
    ↓
[Data Quality Layer]      Pandera schema · corporate action detection · circuit breaker flags
    ↓
[Feature Engineering]     50+ features per symbol per day (price · technical · volume · fundamental · calendar)
    ↓
[Training Pipeline]       XGBoost + LightGBM + LSTM · walk-forward CV · MLflow tracking · DVC versioning
    ↓
[Model Registry]          MLflow: Staging → Production promotion
    ↓
[Drift Monitoring]        Evidently AI (PSI) · weekly scheduled or drift-triggered retraining
    ↓
[Inference Pipeline]      FastAPI → Celery → Redis · TreeSHAP inline · GradientExplainer async
    ↓
[API Response]            prediction probability + direction + top-10 feature contributions (%)
```

---

## 1. Feature Engineering

### Library Stack

```bash
pip install ta pandas_ta pandera mlflow dvc evidently scikit-learn imbalanced-learn shap lightgbm xgboost torch
```

Use `ta` (Technical Analysis library) as the primary indicator engine:
```python
import ta
df = ta.add_all_ta_features(df, open='open', high='high', low='low', close='close', volume='volume')
```

### Feature Groups (Ranked by Predictive Value on DSE)

#### Priority 1 — Price-Derived Features (Highest Signal)

| Feature | Code |
|---------|------|
| Lagged returns | `close.pct_change(n)` for n = 1, 2, 5, 10, 21 |
| Rolling return mean | `close.pct_change().rolling(n).mean()` for n = 5, 10, 21, 63 |
| Rolling volatility | `close.pct_change().rolling(n).std()` for n = 5, 10, 21, 63 |
| 200-day z-score | `(close - close.rolling(200).mean()) / close.rolling(200).std()` |
| High-low spread | `(high - low) / close` |
| Intraday return | `(close - open) / open` |
| Consecutive up/down streak | Count of consecutive positive/negative days |

#### Priority 2 — Technical Indicators (Medium-High Signal)

| Indicator | Notes |
|-----------|-------|
| RSI-14 | Overbought/oversold; RSI + MACD combo outperforms either alone on DSE |
| MACD | Include MACD line, signal line (9-period EMA), and histogram as separate features |
| Bollinger Bands | Include `%B` position and bandwidth as separate features |
| ATR-14 | Volatility-adjusted; use as a standalone feature |
| Stochastic %K and %D | |
| EMA crossover flags | EMA-5 vs EMA-21 (binary), EMA-50 vs EMA-200 (golden/death cross binary) |

#### Priority 3 — Volume Indicators (Critical for Thin DSE Market)

| Indicator | Notes |
|-----------|-------|
| OBV (On-Balance Volume) | Cumulative volume signed by direction; strong on DSE where institutional flows dominate |
| VWAP deviation | `(close - VWAP) / VWAP` — intraday mean reversion signal |
| Volume z-score | `(volume - volume.rolling(20).mean()) / volume.rolling(20).std()` |
| Volume ratio | `volume / volume.rolling(20).mean()` — spike detection |
| MFI-14 (Money Flow Index) | RSI variant with volume; particularly effective in thin emerging markets |

#### Priority 4 — Fundamental Features (Quarterly, Point-in-Time Only)

| Feature | Critical Note |
|---------|---------------|
| PE ratio, PB ratio, EPS | **Use only last known quarterly filing at the prediction date — never future values** |
| Earnings surprise | Actual EPS minus consensus estimate |
| Dividend yield | |
| Sector / industry label | DSE has ~20 sectors; use LightGBM native categorical — do not one-hot encode |
| Market cap bucket | Small / mid / large-cap binary flag |

#### Priority 5 — Calendar Features (DSE-Specific Seasonality)

| Feature | Implementation |
|---------|----------------|
| Day of week | Sine/cosine encode: `sin(2π * dow / 5)`, `cos(2π * dow / 5)` — not one-hot |
| Month of year | Sine/cosine encode similarly |
| Ramadan binary flag | DSE shows significant seasonality during Ramadan — convert Islamic calendar |
| Pre/post-earnings window | Binary flag for ±2 trading days around earnings announcement date |

### Feature Pipeline Code

```python
import pandas as pd
import numpy as np
import ta

def build_feature_pipeline(df: pd.DataFrame) -> pd.DataFrame:
    # Sort ascending — critical to prevent leakage
    df = df.sort_values("date").reset_index(drop=True)

    # --- Price features ---
    for lag in [1, 2, 5, 10, 21]:
        df[f"return_lag_{lag}"] = df["close"].pct_change(lag)

    for window in [5, 10, 21, 63]:
        df[f"vol_{window}d"] = df["close"].pct_change().rolling(window).std()
        df[f"return_mean_{window}d"] = df["close"].pct_change().rolling(window).mean()

    df["zscore_200d"] = (
        (df["close"] - df["close"].rolling(200).mean())
        / df["close"].rolling(200).std()
    )
    df["hl_spread"] = (df["high"] - df["low"]) / df["close"]
    df["intraday_return"] = (df["close"] - df["open"]) / df["open"]

    # --- Technical indicators ---
    df["rsi_14"] = ta.momentum.RSIIndicator(df["close"], window=14).rsi()
    macd = ta.trend.MACD(df["close"])
    df["macd"] = macd.macd()
    df["macd_signal"] = macd.macd_signal()
    df["macd_hist"] = macd.macd_diff()
    bb = ta.volatility.BollingerBands(df["close"], window=20)
    df["bb_pct_b"] = bb.bollinger_pband()
    df["bb_bandwidth"] = bb.bollinger_wband()
    df["atr_14"] = ta.volatility.AverageTrueRange(
        df["high"], df["low"], df["close"], window=14
    ).average_true_range()

    # --- Volume features ---
    df["obv"] = ta.volume.OnBalanceVolumeIndicator(
        df["close"], df["volume"]
    ).on_balance_volume()
    df["mfi_14"] = ta.volume.MFIIndicator(
        df["high"], df["low"], df["close"], df["volume"], window=14
    ).money_flow_index()
    df["volume_zscore"] = (
        (df["volume"] - df["volume"].rolling(20).mean())
        / df["volume"].rolling(20).std()
    )
    df["volume_ratio"] = df["volume"] / df["volume"].rolling(20).mean()

    # --- Calendar features (sine/cosine encoding) ---
    df["date"] = pd.to_datetime(df["date"])
    df["dow_sin"] = np.sin(2 * np.pi * df["date"].dt.dayofweek / 5)
    df["dow_cos"] = np.cos(2 * np.pi * df["date"].dt.dayofweek / 5)
    df["month_sin"] = np.sin(2 * np.pi * df["date"].dt.month / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["date"].dt.month / 12)

    # --- Label: next-day close direction (strictly forward-looking, label only) ---
    df["label"] = (df["close"].shift(-1) > df["close"]).astype(int)

    # Drop rows with NaN from rolling windows
    df = df.dropna().reset_index(drop=True)
    return df
```

---

## 2. Data Quality Validation

Run these checks before every training job. Any failure halts the pipeline and emits an alert.

### Pandera Schema Validation

```python
import pandera as pa
from pandera import Column, DataFrameSchema, Check

ohlcv_schema = DataFrameSchema({
    "symbol":  Column(str,   Check.str_length(min_val=1, max_val=20)),
    "date":    Column(pa.DateTime),
    "open":    Column(float, Check.greater_than(0)),
    "high":    Column(float, Check.greater_than(0)),
    "low":     Column(float, Check.greater_than(0)),
    "close":   Column(float, Check.greater_than(0)),
    "volume":  Column(float, Check.greater_than_or_equal_to(0)),
}, coerce=True)
# Cross-column checks run separately: high >= low, close between high and low
```

### Financial-Specific Checks

```python
def check_stale_data(df: pd.DataFrame, today: pd.Timestamp, symbol: str):
    last_date = df[df["symbol"] == symbol]["date"].max()
    gap = len(pd.bdate_range(last_date, today)) - 1
    if gap > 1:
        raise DataQualityError(f"Stale data for {symbol}: {gap} trading days since last record")

def check_price_outliers(df: pd.DataFrame, z_threshold: float = 5.0) -> pd.DataFrame:
    df["log_return"] = np.log(df["close"] / df["close"].shift(1))
    rolling_std = df["log_return"].rolling(20).std()
    df["return_zscore"] = (
        df["log_return"] - df["log_return"].rolling(20).mean()
    ) / rolling_std
    return df[np.abs(df["return_zscore"]) > z_threshold]

def check_circuit_breaker(df: pd.DataFrame, limit_pct: float = 0.10) -> pd.DataFrame:
    # Flag days where price hit DSE 10% circuit limit or zero volume
    df["daily_return"] = df["close"].pct_change()
    df["circuit_breaker"] = (
        (np.abs(df["daily_return"]) >= limit_pct * 0.99) | (df["volume"] == 0)
    )
    return df[df["circuit_breaker"]]

def adjust_for_splits(df: pd.DataFrame, splits: dict) -> pd.DataFrame:
    for date_str, ratio in splits.items():
        date = pd.Timestamp(date_str)
        mask = df["date"] < date
        df.loc[mask, ["open", "high", "low", "close"]] /= ratio
        df.loc[mask, "volume"] *= ratio
    return df
```

---

## 3. Model Training

### Critical Rules: Preventing Data Leakage

1. **Sort by date before any split** — never shuffle financial time series
2. **Fit scaler on training set only** — `scaler.fit(X_train)`, `scaler.transform(X_test)`
3. **SMOTE only on training set** — apply `imblearn.over_sampling.SMOTE` after the train/test split
4. **Rolling windows look backward only** — all `.rolling(n).mean()` use historical data only
5. **Label uses `.shift(-1)`** — this is the only forward-looking element and must never appear as a feature
6. **Purge embargo** — leave a gap between train and test windows to prevent label overlap

### Walk-Forward Cross-Validation

```python
from sklearn.model_selection import TimeSeriesSplit

tscv = TimeSeriesSplit(n_splits=5, gap=5)  # 5-day embargo between train and test
for train_idx, test_idx in tscv.split(X):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
    # Fit scaler on train only
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
```

### Prediction Sharpe (Primary Evaluation Metric)

Accuracy and F1 are secondary. This is the metric that determines if a model is actually useful:

```python
def prediction_sharpe(proba: np.ndarray, actual_returns: np.ndarray,
                      threshold: float = 0.5) -> float:
    positions = np.where(proba > threshold, 1, -1)  # long or short
    strategy_returns = positions * actual_returns
    return (strategy_returns.mean() / strategy_returns.std()) * np.sqrt(252)
```

A model with 55% accuracy and Sharpe 1.4 is better than 65% accuracy and Sharpe 0.3.

### XGBoost Training

```python
import xgboost as xgb
import mlflow

params = {
    "n_estimators": 500,
    "max_depth": 6,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "scale_pos_weight": neg_count / pos_count,  # class imbalance
    "eval_metric": "logloss",
    "early_stopping_rounds": 50,
    "tree_method": "hist",
}

with mlflow.start_run(run_name="xgb_dse_v1"):
    mlflow.log_params(params)
    model = xgb.XGBClassifier(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=50)

    f1 = f1_score(y_test, model.predict(X_test))
    sharpe = prediction_sharpe(model.predict_proba(X_test)[:, 1], returns_test)
    mlflow.log_metric("f1", f1)
    mlflow.log_metric("prediction_sharpe", sharpe)
    mlflow.xgboost.log_model(model, "xgb_model")
```

### LightGBM Training

Preferred over XGBoost for DSE because:
- Leaf-wise tree growth is faster on 100+ feature sets
- Native categorical support for sector labels (no one-hot encoding needed)

```python
import lightgbm as lgb

dtrain = lgb.Dataset(X_train, label=y_train, categorical_feature=["sector_id"])
dval   = lgb.Dataset(X_test,  label=y_test,  reference=dtrain)

params = {
    "objective": "binary",
    "metric": "binary_logloss",
    "num_leaves": 63,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "is_unbalance": True,
    "verbose": -1,
}

model = lgb.train(
    params, dtrain, num_boost_round=1000,
    valid_sets=[dval],
    callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)],
)
```

### LSTM Training

```python
import torch
import torch.nn as nn

class StockLSTM(nn.Module):
    def __init__(self, input_dim, hidden_dim=128, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers,
                            batch_first=True, dropout=dropout)
        self.fc = nn.Linear(hidden_dim, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.sigmoid(self.fc(out[:, -1, :]))

# Build sequences: lookback window = 20 trading days
LOOKBACK = 20
X_seq = np.array([X_scaled[i:i+LOOKBACK] for i in range(len(X_scaled) - LOOKBACK)])
y_seq = y.values[LOOKBACK:]
```

### Ensemble

Combine all three models with weighted averaging. Start with equal weights; tune via backtesting:

```python
# Weighted ensemble
ensemble_proba = 0.4 * xgb_proba + 0.4 * lgb_proba + 0.2 * lstm_proba
```

### DVC Pipeline Definition

```yaml
# dvc.yaml
stages:
  featurize:
    cmd: python src/featurize.py
    deps: [data/raw/dse_ohlcv.parquet]
    outs: [data/features/dse_features.parquet]

  validate:
    cmd: python src/validate.py
    deps: [data/features/dse_features.parquet]
    outs: [data/validated/dse_features_clean.parquet]

  train_xgb:
    cmd: python src/train_xgb.py
    deps: [data/validated/dse_features_clean.parquet]
    params: [params.yaml:xgb]
    metrics: [metrics/xgb_metrics.json]
    outs: [models/xgb_model.pkl]

  train_lstm:
    cmd: python src/train_lstm.py
    deps: [data/validated/dse_features_clean.parquet]
    params: [params.yaml:lstm]
    metrics: [metrics/lstm_metrics.json]
    outs: [models/lstm_model.pt]
```

Run `dvc repro` to deterministically reproduce any historical model version.

---

## 4. Model Retraining Strategy

### Retraining Frequency

| Trigger | Frequency | Rationale |
|---------|-----------|-----------|
| Scheduled | Weekly (Sunday 18:00 BDT) | DSE is high-volatility; signals decay faster than developed markets |
| Drift-triggered | On Evidently PSI > 0.2 for >5 features | Distribution shift indicates regime change |
| Corporate action | Immediately on split/dividend detection | Adjusted prices invalidate features built on unadjusted history |

### Drift Monitoring with Evidently AI

```python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset
from evidently.test_suite import TestSuite
from evidently.tests import TestNumberOfDriftedColumns

# Run daily after market close
report = Report(metrics=[DataDriftPreset()])
report.run(reference_data=baseline_features, current_data=today_features)

# Retraining trigger
suite = TestSuite(tests=[TestNumberOfDriftedColumns(lt=5)])
suite.run(reference_data=baseline_features, current_data=today_features)
if not suite.as_dict()["summary"]["all_passed"]:
    trigger_retraining_flow()
```

Use PSI (Population Stability Index) as the drift metric — industry standard from credit risk:
- PSI < 0.1: No significant change
- PSI 0.1–0.2: Moderate change; monitor
- PSI > 0.2: Major shift; retrain immediately

Note: Validate data quality before running drift analysis. A DSE circuit breaker day looks like drift but is not model degradation.

### Production Metrics to Monitor Daily

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Rolling 20-day F1 | Custom MLflow logger | Drop > 0.05 from baseline |
| Prediction Sharpe (20d) | Custom | Drop below 0.5 |
| PSI of top 5 features | Evidently | PSI > 0.2 |
| Drifted feature count | Evidently | > 5 features |
| Input null rate | Pandera | > 1% nulls |
| Calibration (max proba) | Custom | Distribution shift |

### MLflow Model Registry Promotion

```python
from mlflow.tracking import MlflowClient

client = MlflowClient()

# Register after training
mv = mlflow.register_model(f"runs:/{run_id}/xgb_model", "dse_direction_xgb")

# Promote to Staging for validation
client.transition_model_version_stage("dse_direction_xgb", mv.version, "Staging")

# After backtests pass, promote to Production
client.transition_model_version_stage("dse_direction_xgb", mv.version, "Production")

# Inference workers load from Production alias — zero-downtime swap
model = mlflow.xgboost.load_model("models:/dse_direction_xgb/Production")
```

---

## 5. Inference Pipeline

### Architecture

```
Client
  ↓ POST /api/ml/predict
FastAPI (async) — returns {task_id} immediately
  ↓ apply_async(queue="prediction")
Celery Worker (models loaded ONCE at startup via class-based Task)
  ├─ XGBoost inference:    5–15ms
  ├─ LightGBM inference:   3–10ms
  ├─ LSTM inference:       100–500ms
  └─ TreeSHAP (XGB/LGB):  +3–5ms inline
  ↓ result stored in Redis
FastAPI GET /api/ml/predict/{task_id}  (or WebSocket push)
  ↓
Client receives prediction + SHAP explanation
  ↓ async (separate low-priority Celery queue)
GradientExplainer for LSTM → pushed via WebSocket when ready
```

### Celery Task Design: Load Models Once Per Worker

```python
# tasks.py
from celery import Celery, Task
import mlflow, xgboost as xgb, torch

app = Celery("stock_inference",
             broker="redis://redis:6379/0",
             backend="redis://redis:6379/0")

app.conf.update(
    task_serializer="json",
    result_expires=3600,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

class MLTask(Task):
    _xgb_model = None
    _lgb_model  = None
    _lstm_model = None

    @property
    def xgb_model(self):
        if self._xgb_model is None:
            self._xgb_model = mlflow.xgboost.load_model(
                "models:/dse_direction_xgb/Production"
            )
        return self._xgb_model

    @property
    def lstm_model(self):
        if self._lstm_model is None:
            self._lstm_model = mlflow.pytorch.load_model(
                "models:/dse_direction_lstm/Production"
            )
            self._lstm_model.eval()
        return self._lstm_model

@app.task(bind=True, base=MLTask, max_retries=3,
          default_retry_delay=5, name="predict.direction")
def predict_direction(self, symbol: str, features: list) -> dict:
    import numpy as np
    try:
        X = np.array(features).reshape(1, -1)
        xgb_proba  = self.xgb_model.predict_proba(X)[0, 1]

        X_seq    = np.array(features[-20:]).reshape(1, 20, -1)
        X_tensor = torch.tensor(X_seq, dtype=torch.float32)
        with torch.no_grad():
            lstm_proba = self.lstm_model(X_tensor).item()

        ensemble_proba = 0.6 * xgb_proba + 0.4 * lstm_proba
        return {
            "symbol": symbol,
            "xgb_probability": xgb_proba,
            "lstm_probability": lstm_proba,
            "ensemble_probability": ensemble_proba,
            "direction": "UP" if ensemble_proba > 0.5 else "DOWN",
        }
    except Exception as exc:
        raise self.retry(exc=exc)
```

### Queue Configuration

Run three separate worker pools:

```bash
# High priority: prediction requests from users
celery -A tasks worker -Q prediction --concurrency=4 --pool=prefork

# Low priority: SHAP explanations (slower, less urgent)
celery -A tasks worker -Q shap_explanation --concurrency=2 --pool=prefork

# Batch: weekly training jobs (single worker, long-running)
celery -A tasks worker -Q batch_training --concurrency=1 --pool=solo
```

### FastAPI Endpoints

```python
from fastapi import FastAPI
from pydantic import BaseModel
from tasks import predict_direction

app = FastAPI()

class PredictionRequest(BaseModel):
    symbol: str
    features: list[float]

@app.post("/api/ml/predict")
async def predict(req: PredictionRequest):
    task = predict_direction.apply_async(
        args=[req.symbol, req.features],
        queue="prediction",
        expires=30,
    )
    return {"task_id": task.id, "status": "queued"}

@app.get("/api/ml/predict/{task_id}")
async def get_result(task_id: str):
    result = predict_direction.AsyncResult(task_id)
    if result.ready():
        return result.get()
    return {"status": result.state}
```

---

## 6. SHAP Explainability

### TreeSHAP for XGBoost/LightGBM (Inline, Synchronous)

Runs in 1–5ms. Compute alongside the prediction — no async needed.

```python
import shap, hashlib, pickle, redis

redis_client = redis.Redis(host="redis", decode_responses=False)

# Initialize once per worker
xgb_explainer = shap.TreeExplainer(
    xgb_model,
    feature_perturbation="interventional",
    model_output="probability"
)

def get_xgb_explanation(features: np.ndarray, feature_names: list) -> dict:
    cache_key = f"shap:xgb:{hashlib.sha256(features.tobytes()).hexdigest()}"
    cached = redis_client.get(cache_key)
    if cached:
        return pickle.loads(cached)

    shap_values = xgb_explainer.shap_values(features)[0]
    base_value  = xgb_explainer.expected_value
    total_abs   = np.abs(shap_values).sum()

    contributions = sorted([
        {
            "feature": feature_names[i],
            "raw_value": float(features[0, i]),
            "shap_value": float(shap_values[i]),
            "contribution_pct": round(abs(float(shap_values[i])) / total_abs * 100, 1),
            "direction": "bullish" if shap_values[i] > 0 else "bearish",
        }
        for i in range(len(feature_names))
    ], key=lambda x: abs(x["shap_value"]), reverse=True)[:10]

    result = {
        "base_probability": float(base_value),
        "model_probability": float(base_value + shap_values.sum()),
        "top_features": contributions,
        "method": "TreeSHAP",
    }
    redis_client.setex(cache_key, 86400, pickle.dumps(result))
    return result
```

### GradientExplainer for LSTM (Async Queue)

Use `shap.GradientExplainer` — more stable than `DeepExplainer` for LSTM gating mechanisms.

```python
@app.task(queue="shap_explanation", name="explain.lstm")
def explain_lstm_async(symbol: str, sequence: list, feature_names: list):
    import shap, torch, numpy as np

    background  = torch.tensor(X_background_sequences, dtype=torch.float32)  # 100-200 samples
    lstm_explainer = shap.GradientExplainer(lstm_model, background)

    X = torch.tensor([sequence], dtype=torch.float32)
    shap_values = lstm_explainer.shap_values(X)
    # Aggregate across timesteps: mean abs SHAP per feature
    feature_importance = np.abs(shap_values[0]).mean(axis=1)
    total = feature_importance.sum()

    result = {
        "symbol": symbol,
        "method": "GradientExplainer",
        "feature_contributions": [
            {
                "feature": feature_names[i],
                "contribution_pct": round(float(feature_importance[i] / total * 100), 1),
            }
            for i in np.argsort(feature_importance)[::-1][:10]
        ],
    }
    redis_client.setex(f"shap:lstm:{symbol}", 3600, pickle.dumps(result))
    return result
```

### SHAP Caching Strategy

| Cache Key | TTL | When to Invalidate |
|-----------|-----|--------------------|
| `shap:xgb:{feature_hash}` | 24 hours | New model version deployed |
| `shap:lstm:{symbol}` | 1 hour | Intraday — LSTM explanations are heavier |
| Pre-computed top-50 | 24 hours | Run nightly batch for most-viewed symbols |

Pre-compute SHAP for the top 50 DSE symbols every night as a batch job. Serve from cache during market hours.

### User-Facing Output Format

```json
{
  "recommendation": "BUY",
  "probability": 0.67,
  "explanation": {
    "summary": "Recommendation driven primarily by volume surge and below-sector PE ratio.",
    "top_factors": [
      { "factor": "Volume surge (3-day vs 30-day avg)", "contribution": "40%", "signal": "bullish" },
      { "factor": "P/E ratio vs sector median", "contribution": "30%", "signal": "bullish" },
      { "factor": "Positive news sentiment", "contribution": "20%", "signal": "bullish" },
      { "factor": "Revenue growth (last 2Q)", "contribution": "10%", "signal": "bearish" }
    ]
  }
}
```

---

## 7. Pipeline Orchestration (Prefect)

Recommended for small teams (2-8 engineers). Zero daemon required locally; free tier sufficient.

```python
from prefect import flow, task
from prefect.schedules import CronSchedule

@task(retries=3, retry_delay_seconds=60)
def fetch_dse_data(symbols: list) -> pd.DataFrame: ...

@task
def validate_data(df: pd.DataFrame) -> pd.DataFrame:
    ohlcv_schema.validate(df)
    return df

@task
def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    return build_feature_pipeline(df)

@task
def check_drift(features: pd.DataFrame) -> bool:
    suite = TestSuite(tests=[TestNumberOfDriftedColumns(lt=5)])
    suite.run(reference_data=baseline, current_data=features)
    return not suite.as_dict()["summary"]["all_passed"]

@task(log_prints=True)
def retrain_models(features: pd.DataFrame): ...

@task
def precompute_shap_top50(symbols: list): ...

@flow(
    name="dse-daily-ml-pipeline",
    schedule=CronSchedule(cron="0 18 * * 1-5"),  # 18:00 BDT daily after market close
)
def daily_pipeline():
    df       = fetch_dse_data(DSE_SYMBOLS)
    df       = validate_data(df)
    features = compute_features(df)
    needs_retrain = check_drift(features)
    if needs_retrain:
        retrain_models(features)
    precompute_shap_top50(TOP_50_SYMBOLS)
```

Use **Dagster** instead if strong data lineage tracking is needed. Avoid **Airflow** — too much operational overhead for a small fintech team.

---

## 8. Tool Reference

| Category | Primary Tool | Alternative |
|----------|-------------|-------------|
| Technical indicators | `ta` (Python TA library) | `pandas_ta`, `stockstats` |
| Data versioning | DVC | LakeFS |
| Experiment tracking | MLflow | Weights & Biases |
| Model registry | MLflow Model Registry | BentoML Store |
| Pipeline orchestration | Prefect | Dagster |
| Schema validation | Pandera | Great Expectations |
| Production drift monitoring | Evidently AI | WhyLabs, Arize |
| Tree explainability | SHAP TreeExplainer | LIME |
| DL explainability | SHAP GradientExplainer | Captum (PyTorch-native) |
| Class imbalance | imbalanced-learn SMOTE | XGBoost `scale_pos_weight` |
| Time-series CV | `sklearn.TimeSeriesSplit` | `mlfinlab` PurgedKFold |
| Model serving | FastAPI + Celery | BentoML |
| Caching | Redis | — |
