# VocaGame E2E Test Automation (Playwright)

![Playwright](https://img.shields.io/badge/Playwright-1.63-2EAD33?logo=playwright&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Browsers](https://img.shields.io/badge/browsers-Chromium%20%7C%20Firefox%20%7C%20WebKit-informational)

End-to-end test suite for the **Mobile Legends top-up order flow** on [VocaGame](https://vocagame.com), a game top-up and voucher store. The suite is built from a manual test plan of 81 test cases (positive and negative) and covers the page display, account input, contact info, denomination selection, payment popup, and voucher.

> Personal portfolio project. Not affiliated with or endorsed by VocaGame.

## Highlights

- **Traceable to the test plan.** Every test title starts with its TC_ID from [`VocaGame - Playwright.csv`](./VocaGame%20-%20Playwright.csv) (for example `OP-022`, `OV-010`). Cases that can't be automated through the UI are still listed in the report as `fixme` with the reason.
- **Page Object Model with fixtures.** Specs ask for `homePage`, `productPage`, or `paymentDialog` and get a ready page object; no locators in the spec files.
- **Production and staging.** One switch (`TEST_ENV`) changes the target URL, headless mode, and whether order-creating tests run. Reports and artifacts are kept separately per environment.
- **Safe by design.** Tests that click **Buy** (and create a real transaction) are tagged `@creates-order` and can be turned off with one variable.
- **Built for a real, non-deterministic site.** Handles a form that resets itself after load, cards that need a second click before hydration, and a search box that clears itself (see [Challenges solved](#challenges-solved)).
- **No secrets in the repo.** Test account data comes from `.env` locally and GitHub Secrets in CI.
- **Useful artifacts only.** Trace and screenshot are kept for failed tests; video is kept only for passed tests (custom fixture).

## Test coverage

| Area                                                                       | Automated | Manual (`fixme`) |
| -------------------------------------------------------------------------- | --------- | ---------------- |
| Page display (load, cards, category tabs, responsive, language)            | 6         | –                |
| Account input (User ID, Zone ID, nickname check, length, paste, injection) | 15        | –                |
| Contact info (email format, phone in email, injection, long value)         | 8         | –                |
| Denomination selection                                                     | 12        | –                |
| Payment method and order review                                            | 4         | –                |
| Place order (`@creates-order`)                                             | 3         | 7                |
| Voucher                                                                    | 6         | 10               |
| Payment gateway, security, session                                         | –         | 11               |
| **Total per browser**                                                      | **54**    | **28**           |

Run on Chromium, Firefox, and WebKit. Manual cases need things outside the UI (a real payment, in-game delivery, email inbox, request tampering, valid voucher codes).

## Tech stack

- [Playwright Test](https://playwright.dev) 1.63, TypeScript (strict)
- Node.js 24 (uses the built-in `process.loadEnvFile`, no dotenv)
- GitHub Actions workflow in [`.github/workflows/playwright.yml`](./.github/workflows/playwright.yml)

## Project structure

```text
.
├── playwright.config.ts          # Browsers, timeouts, retries, report/artifact folders per environment
├── .env.example                  # TEST_ENV, STAGING_URL, RUN_ORDERS, test account
├── .github/workflows/            # CI: Chromium, no orders
├── VocaGame - Playwright.csv     # Source test plan (TC_ID, steps, expected result)
└── tests/
    ├── fixtures/
    │   ├── env.ts                # Production / staging settings
    │   ├── config.ts             # Test data: products, denominations, payment methods, messages, invalid data
    │   └── test.ts               # `test` with page-object fixtures, video-only-on-pass, manualCase()
    ├── pages/
    │   ├── HomePage.ts           # Search
    │   ├── ProductPage.ts        # Account form, contact, denomination cards
    │   └── PaymentDialog.ts      # Payment methods, voucher, order detail, Buy
    └── order/
        ├── order_positive_case.spec.ts
        └── order_negative_case.spec.ts
```

## Getting started

```bash
npm ci
npx playwright install --with-deps
cp .env.example .env    # then fill in the test account
```

The test account (email, Mobile Legends User ID, Zone ID, nickname) is personal data, so it lives in `.env` and is never committed. The suite stops with a clear message if a required value is missing.

### Run

| Command                                     | What it does                        |
| ------------------------------------------- | ----------------------------------- |
| `npm test`                                  | All tests, all browsers             |
| `npm run test:ui`                           | Playwright UI mode                  |
| `npm run test:chromium`                     | Chromium only, one worker           |
| `npm run report` / `npm run report:staging` | Open the HTML report                |
| `npx playwright test --grep @negative`      | Negative cases only                 |
| `npx playwright test --grep @manual --list` | List manual cases and their reasons |

### Environment

| Variable                       | Values                             | Default                                      |
| ------------------------------ | ---------------------------------- | -------------------------------------------- |
| `TEST_ENV`                     | `production`, `staging`            | `production`                                 |
| `STAGING_URL`                  | Any URL                            | `https://staging.vocagame.dev`               |
| `RUN_ORDERS`                   | `1` run `@creates-order`, `0` skip | `ordersByDefault` in `tests/fixtures/env.ts` |
| `TEST_EMAIL`                   | Email for the order receipt        | required                                     |
| `TEST_USER_ID`, `TEST_ZONE_ID` | A real Mobile Legends account      | required                                     |
| `TEST_NICKNAME`                | In-game nickname of that account   | required                                     |

Set them in `.env` or in the terminal (the terminal wins):

```powershell
$env:TEST_ENV='staging'; $env:RUN_ORDERS='0'; npx playwright test
```

> ⚠️ `@creates-order` tests click **Buy** and create a real transaction. Use `RUN_ORDERS=0` unless you mean to place orders. Production is a live site: keep `--workers=1` to avoid being rate-limited.

### Continuous integration

[`.github/workflows/playwright.yml`](./.github/workflows/playwright.yml) runs the suite on every push and pull request to `main`/`master`: Chromium only, one worker, and always with `RUN_ORDERS=0` so CI never places an order. Add `TEST_EMAIL`, `TEST_USER_ID`, `TEST_ZONE_ID`, and `TEST_NICKNAME` under **Settings → Secrets and variables → Actions**. The HTML report is uploaded as an artifact.

### Tags

| Tag              | Meaning                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `@order`         | Every test in the order suite                                       |
| `@negative`      | Negative cases                                                      |
| `@creates-order` | Clicks Buy (real transaction)                                       |
| `@manual`        | Not automatable through the UI; reported as `fixme` with the reason |

## Challenges solved

| Problem on the live site                                                                                              | Solution                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| The product form clears itself once after load (sometimes after several seconds), wiping values typed too early       | `fillUntilKept()`: fill, wait, verify, and refill until the values persist |
| Before hydration the first click on a denomination only reveals the cards; after hydration it opens the payment popup | `clickDenomination()` checks the state and clicks again only when needed   |
| The homepage search box sometimes clears itself                                                                       | Search wrapped in `expect().toPass()` so it retries until a result appears |
| The account inputs are never "stable" for Playwright's `click()`                                                      | Focus the field instead of clicking it                                     |
| Cloudflare blocked headless browsers for a period (HTTP 403 challenge)                                                | `headless` is configurable per environment                                 |
| Production and staging use different field types and labels                                                           | One locator that matches both (`spinbutton` or `textbox`)                  |
| Playwright has no "keep video only on pass" option                                                                    | Auto fixture deletes the video of failed tests                             |

## Notable findings

Running the plan against production surfaced behavior that differs from the expected results. The tests keep the expected result from the plan, so these show up as failures:

- Email with leading or trailing spaces is rejected instead of trimmed (OP-059).
- Pasting `ID(Zone)` into User ID produces an incorrect value instead of splitting it (OP-054).
- A 300-character email is accepted (OP-049).
- No length validation on User ID and Zone ID (OP-045, OP-046), and Zone ID accepts `12.4` (OP-027).
