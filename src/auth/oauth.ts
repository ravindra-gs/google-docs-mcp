import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { join, dirname } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import {
  type StoredTokens,
  type OAuthConfig,
  type GoogleClientSecret,
  SCOPES,
  CREDENTIALS_DIR,
  TOKENS_FILE,
} from "../types/index.js";

const CLIENT_SECRET_FILE = "client_secret.json";

/**
 * Load credentials from client_secret.json file
 */
function loadClientSecret(basePath: string): OAuthConfig | null {
  const possiblePaths = [
    join(basePath, CLIENT_SECRET_FILE),
    join(basePath, CREDENTIALS_DIR, CLIENT_SECRET_FILE),
  ];

  for (const filePath of possiblePaths) {
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const secret: GoogleClientSecret = JSON.parse(content);

        // Handle both "installed" (desktop) and "web" credential types
        const credentials = secret.installed || secret.web;

        if (credentials) {
          return {
            clientId: credentials.client_id,
            clientSecret: credentials.client_secret,
            redirectUri:
              credentials.redirect_uris?.[0] ||
              "http://localhost:3000/oauth2callback",
          };
        }
      } catch {
        // Continue to next path
      }
    }
  }

  return null;
}

export class GoogleOAuth {
  private oauth2Client: OAuth2Client;
  private credentialsPath: string;

  constructor(config?: Partial<OAuthConfig>) {
    const baseDir = process.env.GOOGLE_CREDENTIALS_PATH || process.cwd();

    // Try to load from client_secret.json first
    const fileConfig = loadClientSecret(baseDir);

    // Priority: explicit config > client_secret.json > environment variables
    const clientId =
      config?.clientId || fileConfig?.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret =
      config?.clientSecret ||
      fileConfig?.clientSecret ||
      process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      config?.redirectUri ||
      fileConfig?.redirectUri ||
      "http://localhost:3000/oauth2callback";

    if (!clientId || !clientSecret) {
      throw new Error(
        "Google credentials not found. Please either:\n" +
          "  1. Place client_secret.json in the project root, or\n" +
          "  2. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables"
      );
    }

    this.oauth2Client = new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
    });

    this.credentialsPath = join(baseDir, CREDENTIALS_DIR, TOKENS_FILE);
  }

  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
  }

  async exchangeCodeForTokens(code: string): Promise<StoredTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await this.saveTokens(tokens as StoredTokens);
    return tokens as StoredTokens;
  }

  async loadTokens(): Promise<boolean> {
    try {
      if (!existsSync(this.credentialsPath)) {
        return false;
      }

      const tokensJson = readFileSync(this.credentialsPath, "utf-8");
      const tokens: StoredTokens = JSON.parse(tokensJson);

      if (!tokens.refresh_token) {
        return false;
      }

      this.oauth2Client.setCredentials(tokens);
      return true;
    } catch {
      return false;
    }
  }

  async saveTokens(tokens: StoredTokens): Promise<void> {
    const dir = dirname(this.credentialsPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.credentialsPath, JSON.stringify(tokens, null, 2));
  }

  async refreshAccessToken(): Promise<void> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
    await this.saveTokens(credentials as StoredTokens);
  }

  getClient(): OAuth2Client {
    return this.oauth2Client;
  }

  isAuthenticated(): boolean {
    const credentials = this.oauth2Client.credentials;
    return !!(credentials && credentials.refresh_token);
  }

  getDocsClient() {
    return google.docs({ version: "v1", auth: this.oauth2Client });
  }

  getSheetsClient() {
    return google.sheets({ version: "v4", auth: this.oauth2Client });
  }

  getDriveClient() {
    return google.drive({ version: "v3", auth: this.oauth2Client });
  }
}

// Singleton instance
let oauthInstance: GoogleOAuth | null = null;

export function getOAuthInstance(): GoogleOAuth {
  if (!oauthInstance) {
    oauthInstance = new GoogleOAuth();
  }
  return oauthInstance;
}

export async function ensureAuthenticated(): Promise<GoogleOAuth> {
  const oauth = getOAuthInstance();
  const loaded = await oauth.loadTokens();

  if (!loaded) {
    throw new Error(
      'Not authenticated. Please run "bun run auth" to authenticate with Google first.'
    );
  }

  return oauth;
}
