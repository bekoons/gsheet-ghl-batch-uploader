# gsheet-ghl-batch-uploader

Node.js + TypeScript CLI to read contacts from **Google Sheets** and batch upsert them to **GoHighLevel / LeadConnector**.

## Features

- Reads rows from a Google Spreadsheet ID + tab name using Sheets API v4.
- First row is treated as headers, following rows as data.
- Config-driven mapping (`columnMap`, `contactFieldMap`, `customFieldMap`, `optionValueMap`).
- Upserts contacts using `POST https://services.leadconnectorhq.com/contacts/upsert`.
- Retries on 429 and 5xx with exponential backoff (max 3 attempts).
- Supports dry-run mode and row slicing (`--offset`, `--limit`).
- Per-run trace id logging.
- Writes JSON + CSV reports to `./reports`.

## Prerequisites

- Node.js 18+
- A Google Sheet with headers in row 1
- A GoHighLevel (LeadConnector) API token + location ID

## Install

```bash
npm install
cp config/accounts/default.example.json config/accounts/default.json
```

Edit `config/accounts/default.json` with your values.

## Google Sheets Auth

This tool supports two auth modes.

### A) Service Account (recommended)

1. In Google Cloud Console, enable **Google Sheets API**.
2. Create a **Service Account**.
3. Create/download a JSON key.
4. Share your Google Sheet with the service account email (Viewer access is enough).
5. Put key file at `./secrets/service-account.json` **or** set:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

Default mode is service account.

### B) OAuth user credentials (optional)

1. Create OAuth client credentials in Google Cloud.
2. Save client json to `./secrets/oauth-client.json`.
3. Obtain and store user token at `./secrets/oauth-token.json`.
4. Set:

```bash
export GOOGLE_AUTH_MODE=oauth
# optional overrides:
# export GOOGLE_OAUTH_CLIENT_CREDENTIALS=./secrets/oauth-client.json
# export GOOGLE_OAUTH_TOKEN_PATH=./secrets/oauth-token.json
```

## Usage

Dry-run validation (no GHL API calls):

```bash
npm run upload -- --account default --dry-run
```

Real upload:

```bash
npm run upload -- --account default --concurrency 3
```

### CLI flags

- `--account <id>` (required)
- `--dry-run`
- `--limit <n>`
- `--offset <n>`
- `--concurrency <n>` (default: 3)
- `--stop-on-error`

## Synthetic email rule

If both email and phone are missing:

- Build `prospect_key` from normalized `linkedin_profile_url`
  - lowercase host
  - strip query/hash
  - remove trailing slash
  - sha256 hash → first 14 hex chars
  - prefix with `li_`
- Build synthetic email:
  - `oops+<prospect_key>@prospectif.ai`
- If configured, `identity.prospect_key` custom field is sent.

## Validation and safety

- `linkedin_profile_url` must start with `https://www.linkedin.com/in/`
- Missing/invalid LinkedIn URL rows are skipped with reason.
- Access tokens are never printed in logs.
- Every outbound run is tagged with a trace id.

## Report output

Each run writes:

- `./reports/run_<timestamp>.json`
- `./reports/run_<timestamp>.csv`

Each row includes:

- `rowIndex`
- `linkedin_profile_url`
- `prospect_key`
- `usedSyntheticEmail`
- `status` (`success|failed|skipped`)
- `error` (if any)
- `ghlContactId` (if returned)
