# Market Shaker AI • Telegram Mini App

Read-only OTC manual signal assistant, designed to run as a **Telegram Mini App** on Android, iPhone or Telegram Desktop. It does not connect to a Pocket Option trading account or place trades.

## What it contains

- Dark, mobile-friendly Mini App with Telegram WebApp integration.
- Read-only candle connector to the independent OTCharts Pocket Option OTC feed, via a **Netlify Function**.
- Five free-tier pair IDs: EURUSD_otc, GBPUSD_otc, USDJPY_otc, AUDUSD_otc, BTCUSD_otc.
- 1m/5m, EMA 9/21, Wilder RSI 14, candle momentum filter.
- Stale, incomplete, or gapped candles display **NO SIGNAL**.
- CALL / PUT *watch* indications only, trader executes separately on Pocket Option.
- Browser-local history records generated alerts; it **cannot** know whether you traded or won.
- Free plan uses **manual refresh**, not a continuously live scanner. No claims of AI, 95% wins, automatic execution, or estimated probability.

## Simple publishing checklist

1. Create your **own Telegram bot** with [@BotFather](https://t.me/BotFather) (`/newbot`). Keep the bot API token secret; **the Mini App does not need your bot token**.
2. Make a free [OTCharts](https://otcharts.com/pocket-option-api) account and generate its separate, **read-only** API key. Don't paste that key into Telegram or `public/` files.
3. Upload this project's files to a **private GitHub repository**. Extract the ZIP on a computer, then GitHub > New repository > Upload files. Keep the exact `public/`, `netlify/`, and `netlify.toml` paths. Alternatively, use a Git client.
4. On [Netlify](https://app.netlify.com/), choose **Add new project > Import existing project > GitHub**, select your repository. Netlify detects `netlify.toml` (`public` publish folder, `netlify/functions` functions folder). Deploy once.
5. Netlify project > **Project configuration > Environment variables**: add `OTCHARTS_API_KEY` (secret value) to all relevant contexts. Redeploy to load it. *Never* create `public/.env`.
6. Test your Netlify HTTPS address in an ordinary browser. Press **Scan**. The app must show data from the correct OTC market, or an explicit error.
7. Open [@BotFather](https://t.me/BotFather), send `/setmenubutton`, select your bot, enter the **Netlify HTTPS URL**, and set the menu button text to `Market Shaker AI`. Telegram also supports configuring a **Main Mini App** in Bot Settings for a prominent **Open App** button.
8. Open your own bot in Telegram and tap the menu or Open App. The application now runs **inside Telegram**.

Hosting requires an external HTTPS website: Telegram does not execute or host your source code inside the chat itself. Depending on free-tier availability, hosting, API plans, quotas and limits can change. For public launches add authenticated user access and rate limiting to prevent outsiders consuming your private market-data quota. Do **not** share your API keys or BotFather token.

## Testing without deploying

If Node.js 22 is installed, run `npm test`, then `npm start`, then visit http://localhost:3000. Local preview intentionally does **not** connect to OTC data. This is only for visually checking the interface and navigation before deployment.

## Signal logic

- Fetch 80 recent candles for the selected market/timeframe on explicit Scan button press. The provider says 1m and 5m are supported by the `otc` venue.
- Provider documents Pocket Option's candle timestamps as the broker clock **UTC+2**; Netlify function converts to Unix UTC (`-7200s`). Check this alignment against the feed before making decisions. Bad time alignment can make accurate price data appear stale or current incorrectly.
- Do not use the newest candle until its interval has completed (2 second safety delay).
- Require at least 35 usable candles, a fresh most-recent *closed* candle, and no gaps in the last 35 bars. Use the provider's `gaps` warning to conservatively block signals.
- CALL if EMA9 > EMA21, RSI 51–72, final bar advances and is bullish, with ≥20% body/range. PUT is the mirrored condition. These are heuristic rules, **not an AI model**, and their profitability is **not established**.
- Result shows last completed price, RSI, trend and the conditions. This app does not decide a trade amount or claim an entry is still valid by the time you see it.

## Important limitations

- Telegram Mini Apps display **inside Telegram**, and do not create a global floating Android overlay above Pocket Option. For that you would later need a separate native Android overlay app and user permission.
- OTCharts is independent of Pocket Option; source accuracy, delays and availability need verification.
- Never share your Pocket Option password, session ID/SSID, or live account authorization code.
- **No background alerts** while Telegram is closed. The scanning button requests a single read-only snapshot.
- This starter is for individual testing, not unrestricted public distribution.
