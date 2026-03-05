import { readFile } from 'node:fs/promises';
import { google } from 'googleapis';

async function getAuthClient() {
  const mode = (process.env.GOOGLE_AUTH_MODE || 'service-account').toLowerCase();
  if (mode === 'oauth') {
    const credentialsPath = process.env.GOOGLE_OAUTH_CLIENT_CREDENTIALS || './secrets/oauth-client.json';
    const tokenPath = process.env.GOOGLE_OAUTH_TOKEN_PATH || './secrets/oauth-token.json';
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    const token = JSON.parse(await readFile(tokenPath, 'utf8'));
    const info = credentials.installed || credentials.web;
    if (!info?.client_id || !info?.client_secret || !info?.redirect_uris?.[0]) {
      throw new Error('Invalid OAuth client credentials file');
    }
    const oauth2Client = new google.auth.OAuth2(info.client_id, info.client_secret, info.redirect_uris[0]);
    oauth2Client.setCredentials(token);
    return oauth2Client;
  }

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error(
      'Missing Google service account credentials path. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

export async function readSheetValues(params: {
  spreadsheetId: string;
  tabName: string;
  range: string;
}) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const a1Range = `${params.tabName}!${params.range}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: a1Range
  });
  return response.data.values ?? [];
}

export async function updateSheetValue(params: {
  spreadsheetId: string;
  tabName: string;
  rowIndex: number;
  columnIndex: number;
  value: string;
}) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const columnA1 = toColumnA1(params.columnIndex + 1);
  const range = `${params.tabName}!${columnA1}${params.rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [[params.value]] }
  });
}

function toColumnA1(columnNumber: number): string {
  let n = columnNumber;
  let result = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
