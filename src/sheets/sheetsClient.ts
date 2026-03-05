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

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || './secrets/service-account.json';
  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
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
