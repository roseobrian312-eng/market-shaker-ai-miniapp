# Market Shaker AI v3 — Telegram Mini App + Chrome Overlay

**This is a full replacement update** for the existing GitHub repository `market-shaker-ai-miniapp`, Netlify site `https://market-shaker-ai-miniapp.netlify.app/`, and Telegram bot `@OptionChappaBot`. You do **not** need a new GitHub repository, Netlify site or Telegram bot.

## What's included

1. **Telegram Mini App:** OTC scanner, charts, two rule-based strategies, saved-candle research, Strategy Lab, manually entered win/loss dashboard, and CSV export.
2. **Machine-learning research prototype:** a real logistic-regression model trained locally from historical OTC candle features, evaluated on a later chronological holdout. This is **only** a research model. No claims of validated accuracy, no live ML signal deployments, no guarantee of profit.
3. **Chrome extension:** draggable compact overlay injected on `pocketoption.com` in Chrome on Windows. It reads the same OTC data service and runs the same rule-based scanner as Telegram, without broker credentials. It shows signals, user-reported win/loss counts and win rate. Click **Scan** to use one provider request; click **Saved** to reuse candles with zero new provider requests.
4. **Safer recording:** Results recorded by the user are marked **user-reported**. They are never described as independently broker-verified. Historical backtest and ML numbers are presented separately.
5. **Zero automatic orders:** no brokers are accessed, no logins read, and no transactions sent. This release is intended for manual OTC signal research and demo testing.

## Important limitations

- The Chrome widget and Telegram Mini App **use the same scoring rules and data API**, but are not yet a synchronized shared live signal session. Each browser has its own saved candles and manually recorded results. They may show different results if they were refreshed at different times. Cross-device synchronization needs a properly authenticated database backend.
- The extension cannot verify that you placed or won a trade on Pocket Option. Manually reported results must be checked against the broker's statement before being called verified.
- The Chrome extension is for **desktop Chrome**, not a Telegram Mini App magically floating on Android. On the phone, use the Telegram Mini App or compatible operating-system multitasking.
- OTCharts is an unofficial **read-only** price provider. You must check whether the returned OTC prices match the platform before using them. Data can lag; a five-second prediction is not a reliable manual entry signal.
- **No continuous scanning on the free 200-request tier**; each click on Fresh Scan normally costs one API request and can exhaust the quota. Saving candles and training local models costs zero further provider requests.
- Permission to locally store data and redistribute it commercially depends on your market data license. Confirm OTCharts terms before selling live market-feed access to other users.
- No proven profitable strategy, no guaranteed win rate, and no automatic order execution. No machine-learning model is used to issue live CALL/PUT signals in this release.

## Installation A — Update existing Telegram Mini App on GitHub

1. Extract the ZIP. Open folder `Market_Shaker_AI_v3`. It contains `public`, `netlify`, `extension`, `test`, `netlify.toml`, `package.json`, `README.md` and `START-HERE.txt`.
2. Open **your existing GitHub repo** `market-shaker-ai-miniapp` (not a new one).
3. Select **Add file → Upload files** and upload **the contents of** `Market_Shaker_AI_v3`, not the containing folder or ZIP. When files with existing names are present, GitHub will offer to update them. Do not delete your repo.
4. Commit the changes to `main`. Netlify should deploy from the repo automatically. Existing environment variables remain in Netlify.
5. In Netlify → Project configuration → Environment variables, check `OTCHARTS_API_KEY` and `SCANNER_ACCESS_CODE` exist with **Production / Functions** scopes. If `SCANNER_ACCESS_CODE` is not present, generate a private code of 16+ characters and add it, then redeploy. **Never share the secrets or save them in GitHub.**
6. After deployment, open `https://market-shaker-ai-miniapp.netlify.app/` in a browser and check that the Strategy Lab contains `Trainable AI Research Model (Beta)` and the scanner includes `Recorded trade results`.
7. Open `@OptionChappaBot` on Telegram and tap Open App. It will keep using the existing HTTPS URL; no new BotFather setup is required.

## Installation B — Load floating widget in desktop Chrome

1. In Windows Chrome, visit `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and select the `extension` folder extracted from the ZIP — **not** the ZIP, GitHub folder, or `public` folder.
3. Chrome should list **Market Shaker AI — OTC Companion**.
4. On that extension card, click **Details → Extension options** (or the card's Options link).
5. Enter the same **private SCANNER_ACCESS_CODE** that you configured in Netlify, then Save. This code stays in Chrome's extension storage. **Do not enter the OTCharts API key into the extension.**
6. Open or refresh `https://pocketoption.com/` in Chrome. On Pocket Option's web page, you'll see the compact **Market Shaker AI** overlay, which you can drag by its title bar, minimize, and reopen.
7. Select an OTC market, click **SCAN · 1 REQUEST**, and review the status. It will show **NO SIGNAL** when the model rules don't find a setup or the feed is stale. For free research, click **SAVED · 0** to analyze already downloaded candles again without another request.
8. If you **actually place** a trade manually, you can use **I WON** or **I LOST** afterward to record the outcome. These entries are not confirmed against broker data and don't automatically sync to Telegram.

**If no overlay appears:** Refresh the Pocket Option tab after installing, check the extension is enabled, and verify the browser's actual address is under `pocketoption.com`. Do not turn on all-site extension permissions or paste your Pocket Option login details into any extension.

## Development checks

Requires Node.js 22+. In the extracted main folder run `npm test`. Run `npm start` to preview the Telegram dashboard at `http://localhost:3000` (the local preview does not call OTCharts; real scans need Netlify). The Netlify function is `netlify/functions/candles.mjs`.

**Security for production:** Access code is basic owner gating, not full authenticated multiuser access. Before selling, add server-side Telegram initData identity validation, per-account quotas and rate limits, and licensed shared data infrastructure. All auto-trading remains disabled and any future direct execution connector must be approved by the broker.
