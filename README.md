# MARKET SHAKER AI v5 — Tick Recorder + Strategy Discovery Lab

An upgrade for the existing `market-shaker-ai-miniapp` GitHub repo, Netlify site, and Telegram `@OptionChappaBot`. Does **not** create a new bot.

## Read this first

**There is no proven profitable OTC strategy in this release.** This is a research/data-acquisition tool, not an automatic trading bot. All win/loss figures produced by the lab are **modeled** outcomes—not Pocket Option-confirmed trades. There is no code that sends Pocket Option buy/sell orders. No claimed win rate or calibrated AI signal confidence.

### What changed from v4

- The existing Mini App and Chrome overlay are preserved.
- The **Strategy Discovery Lab** evaluates 9 fixed candidate methods (including 2 hybrids), automatically ranks candidates on a middle validation period and shows their NEWER final-period results separately. All results are research only. Unlike optimizing on the final holdout, this separation reduces, but does not eliminate, data mining bias.
- **Data QA:** duplicate timestamps, missing candles, discontinuities, calendar-day coverage.
- **Up to 5,000 candles per manual Fresh Scan** (instead of 500), subject to the provider plan's actual history window. More candles per call does not give the free plan access to paid historical depth.
- **IndexedDB archive** preserves imported history in the *same local browser* across refreshes. The original 12,000-bar localStorage snapshot limit is no longer the only place to store research data. Do not depend on browser storage as your only backup.
- **CSV import** for candles exported from the Windows collector; imported candles are research data, not broker trade results.
- **Attended Windows Node.js tick collector:** stores raw OTCharts stream ticks as timestamped NDJSON files and shows a localhost tick monitor for up to 5 symbols. It only runs while the process/window stays open.
- **Offline batch research:** derives thirty-second bars and tests five tick-pattern hypotheses at recorded prices with a configurable 2-second modeled entry delay and 15/20/30/60s simulated expirations. Splits history chronologically 60/20/20, ranks by middle validation period, and keeps holdout separate. Writes a JSON report and importable CSV.

### Important API and broker boundaries

The free OTCharts API provides **candle snapshots only** (reported 200 first-month requests). Live `GET /v1/stream` is a streaming-enabled subscription feature (Lite or higher, as currently advertised). The collector will display an authorization/plan error if your account lacks stream access. It cannot work around the plan restriction. Lite streaming is different from Build historical pagination. A month of old **individual ticks** is not supplied by the candle API. Record permitted ticks continuously over time (or secure a separately licensed historical tick dataset) to obtain that history.

**The Telegram Mini App and Chrome overlay in this build still use snapshot-based live rules.** The Windows collector is an *independent attended component* and shows research-only tick-pattern candidates on a LOCAL monitor. It does not yet synchronize ticks or automated AI orders into Telegram or the Chrome overlay. A separate securely authenticated relay would be needed for that. Netlify short-lived Functions aren't a forever-running collector.

All data files remain local. OTCharts has its own retention/redistribution terms. Do not redistribute vendor feed data or sell live-data access without permission. Pocket Option's execution authorization is a separate issue. Use demo-only research and independently verify the price/time alignment.

## Install the Mini App v5

1. Extract the ZIP. Open `Market_Shaker_AI_v5` (the folder containing `public`, `netlify`, `extension`, `test` etc.).
2. Save a backup branch of the current `main` repo so v4 is recoverable.
3. Open your existing GitHub repository `roseobrian312-eng/market-shaker-ai-miniapp`, choose **Add file → Upload files**, and upload the **contents** of this folder (not the ZIP or outer folder). Commit to your preferred review branch first. Do not upload secrets or the `collector/data` folder.
4. Once reviewed, merge/deploy with Netlify. Keep `OTCHARTS_API_KEY` and `SCANNER_ACCESS_CODE` only in Netlify Production / Functions environment settings. No new secret variable is required for the candle-only Mini App.
5. Open the existing URL `https://market-shaker-ai-miniapp.netlify.app/`. On Scanner, choose asset and timeframe, enter your private scanner access code. Fresh Scan requests up to 5,000 completed candle bars; **one API request**, if supported. Saved Candles and the Lab use no new provider calls.
6. Under Strategy Lab, click **DISCOVER + TEST 9 STRATEGIES**. Inspect both validation and newer holdout (and data quality), not just the headline percentage.

## Import long-term 30-second candles into the Mini App

After running the attended collector and offline research on Windows, `collector/reports/EURUSD_otc-30sec-candles.csv` (and equivalent other pairs) will exist. Open the Mini App on **that same laptop**, select the correct market and **30 SEC** interval, then under Strategy Lab → Import Recorded Candle CSV, choose the correct file. The system saves it to the local IndexedDB archive. Imported candles are only as accurate as the recorded source and are never treated as verified broker execution data.

## Start live tick recording on Windows (requires stream-enabled OTCharts account)

1. Install Node.js 22 or newer from nodejs.org. There are no extra npm dependencies.
2. Open the extracted project folder. Right-click `collector/start-windows.ps1` → Run with PowerShell, or run from PowerShell: `powershell -ExecutionPolicy Bypass -File .\collector\start-windows.ps1`.
3. When prompted, privately paste your **OTCharts** API key. It will not be written to the repo, ZIP or tick logs. You may use your current key only if the plan permits `/v1/stream`. **Do not paste the key into ChatGPT.**
4. Open `http://127.0.0.1:4147/` on the **same laptop** for the live tick monitor. Its readout is research-only. Keep the PowerShell window open; Ctrl+C ends recording. It connects to one multi-symbol SSE stream for up to five markets.
5. Raw tick files append to `collector/data/EURUSD_otc-YYYY-MM-DD.ndjson`, etc. These are valuable data; keep backups yourself. No continuous background recording occurs when the collector is stopped.
6. After enough data is recorded, run `collector/research-windows.ps1` to analyze locally. This consumes **zero OTCharts requests** and creates a JSON result plus importable 30-second CSV files in `collector/reports/`.

For a research month, leave the collector running during attended sessions across days; gaps are reported. To have all-day unattended capture you'd need reliable authorized always-on infrastructure—which is NOT included here.

## Interpretation and validation

- Research scores and strategy rankings are **not** calibrated win probabilities.
- Selection on validation means the final holdout cannot legitimately be used to repeatedly tweak parameters and claim it's still unseen. You need fresh out-of-time tests for revisions.
- Historical results model entry delays but do not know Pocket Option order fill latency or exact settlement; timing matters at 15–30 seconds.
- Account for each symbol's current payout and market openness. The lab uses the manually entered payout assumption, which may differ from current Pocket Option terms.
- Do **not** call a model production-ready based on 500 or 1,000 bars or a handful of winners. Seek many independent days, sufficient signal count, a positive lower confidence bound on expected value, and forward demo replication.
- No martingale and no automatic stake escalations.

## Developer tests

From inside `Market_Shaker_AI_v5` run `npm test`. Preview the existing Mini App with `npm start` (local HTTP preview cannot fetch OTCharts via Netlify). Tick monitor is separate and stream-gated. No tests place broker orders.

## Project files

- `public/discovery-v5.mjs`: chronological candidate research with data quality and uncertainty.
- `public/store-v5.mjs`: long-history IndexedDB storage and CSV import.
- `collector/record.mjs`: attended live SSE collector, private localhost monitor, raw NDJSON.
- `collector/tick-monitor.mjs`: rolling tick aggregation and candidate markers (unvalidated).
- `collector/tick-lab.mjs`: offline tick-pattern hypotheses with latency/expiry simulation and separate validation/holdout.
- `collector/analyze.mjs`: reads recorded NDJSON, exports CSV, writes research JSON.
