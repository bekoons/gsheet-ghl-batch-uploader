# gsheet-ghl-batch-uploader

Node.js + TypeScript CLI to read contacts from **Google Sheets** and batch upsert them to **GoHighLevel / LeadConnector**.

## Features

- Reads rows from a Google Spreadsheet ID + tab name using Sheets API v4.
- First row is treated as headers, following rows as data.
- Config-driven mapping (`columnMap`, `contactFieldMap`, `customFieldMap`, `optionValueMap`).
- Upserts contacts using `POST https://services.leadconnectorhq.com/contacts/upsert`.
- Retries on 429, 5xx, and timeout/network errors with exponential backoff (`ghl.maxRetries` + initial attempt).
- Per-request timeout for upsert (`ghl.timeoutMs`, default `30000`).
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
5. Set one of these env vars to your key file path (precedence shown):

```bash
export GOOGLE_SERVICE_ACCOUNT_JSON=/absolute/path/to/service-account.json
# fallback if GOOGLE_SERVICE_ACCOUNT_JSON is not set:
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

Default mode is service account. If neither env var is set in service-account mode, the CLI exits with a clear error.

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

Dry-run validation (no GHL API calls, no sheet status writeback):

```bash
npm run upload -- --account default --dry-run
```

Real upload:

```bash
npm run upload -- --account default --concurrency 3
```



### Dry-run row output format

For each processed row in `--dry-run`, the CLI prints one pretty JSON object to stdout with:

- `sheetRowNumber`
- `linkedin_profile_url`
- `upsertBody` (exact body that real mode would send)
- `usedSyntheticEmail`
- `optionTranslations` (array of translation audit entries)

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
- Missing/invalid LinkedIn URL rows are classified as `SKIPPED_MISSING_LINKEDIN`.
- Access tokens are never printed in logs.
- Every outbound run is tagged with a trace id.


## Export optionValueMap

Before your first upload to a new GHL location, export option labels for option-style custom fields:

```bash
npm run export:option-map -- --account default
```

Optional flags:

- `--account <id>` (default: `default`)
- `--out <path>` (default: `./reports/optionValueMap_<timestamp>.json`)
- `--options-file <path>` fallback file if API options are incomplete

The exporter reads `config/accounts/<account>.json` for `ghlAccessToken` and `ghlLocationId`, then writes:

- `./reports/optionValueMap_<timestamp>.json`
- `./reports/fieldOptions_<timestamp>.json` (raw option metadata for all `SINGLE_OPTIONS`, `MULTI_SELECT`, and `CHECKBOX` fields, keyed by custom field id)

Fallback `--options-file` format:

```json
{
  "<customFieldId>": {
    "fieldName": "Some Field",
    "dataType": "SINGLE_OPTIONS",
    "options": ["Option A", "Option B"]
  }
}
```

## optionValueMap in account config

`optionValueMap` is optional and scoped by engine key. Values should be normalized keys (`trim().toLowerCase()`) mapped to exact GHL labels:

```json
{
  "optionValueMap": {
    "classification.seniority_level": {
      "vice president": "Vice President",
      "director": "Director"
    }
  }
}
```

During upload, if a mapping exists:

- values are normalized with `trim + lowercase`
- exact label is sent to GHL when mapped
- missing mapping logs a warning and passes through raw value
- `--dry-run` prints per-row translation details

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
- `uploadStatus` (`UPLOADED`, `SKIPPED_MISSING_LINKEDIN`, `FAILED_VALIDATION`, `FAILED_GHL_4XX`, `FAILED_GHL_5XX`, `FAILED_TIMEOUT`)
- `httpStatus` (when available)
- `error` / `errorMessage` (when available)
- `ghlContactId` (if returned)


## Upload status values

Sheet status writeback values are bounded to:

- `UPLOADED`
- `SKIPPED_MISSING_LINKEDIN`
- `FAILED_VALIDATION`
- `FAILED_GHL_4XX`
- `FAILED_GHL_5XX`
- `FAILED_TIMEOUT`

`429` is retried; if retries are exhausted it is written as `FAILED_GHL_4XX`.
