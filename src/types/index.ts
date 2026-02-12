export interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Google Cloud Console client_secret.json format
export interface GoogleClientSecret {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
    project_id?: string;
    auth_uri?: string;
    token_uri?: string;
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
    project_id?: string;
    auth_uri?: string;
    token_uri?: string;
  };
}

export interface DocumentInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount?: number;
  columnCount?: number;
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  sheets: SheetInfo[];
  webViewLink?: string;
}

export interface DocumentContent {
  id: string;
  title: string;
  body: string;
}

export interface SheetData {
  spreadsheetId: string;
  range: string;
  values: string[][];
}

export const SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export const CREDENTIALS_DIR = ".credentials";
export const TOKENS_FILE = "tokens.json";
