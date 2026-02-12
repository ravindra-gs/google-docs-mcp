# Google Docs MCP Server

An MCP (Model Context Protocol) server that provides read-only access to Google Docs and Google Sheets.

## Features

- Read Google Docs content
- Read Google Sheets data
- List accessible documents and spreadsheets
- Search documents by query

## Available Tools

| Tool                | Description                                      |
|---------------------|--------------------------------------------------|
| `get_document`      | Get full content of a Google Doc by ID or URL    |
| `list_documents`    | List accessible Google Docs with optional search |
| `get_spreadsheet`   | Get spreadsheet metadata and sheet list          |
| `get_sheet_data`    | Read data from a specific range                  |
| `list_spreadsheets` | List accessible Sheets with optional search      |

## Setup

### 1. Create Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the following APIs:
   - Google Docs API
   - Google Sheets API
   - Google Drive API
4. Go to **APIs & Services** → **OAuth consent screen**
   - Select "External" user type
   - Fill in the required fields (app name, support email)
   - Add scopes: `docs.readonly`, `spreadsheets.readonly`, `drive.readonly`
   - Add your email as a test user
5. Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Select **Desktop application**
   - Download the JSON file

### 2. Install the Server

```bash
# Clone or navigate to the project
cd google-docs-mcp

# Place your downloaded credentials file in the project root
mv ~/Downloads/client_secret_*.json ./client_secret.json

# Install dependencies
bun install
```

### 3. Authenticate

```bash
bun run auth
```

This will:

1. Open your browser for Google login
2. Ask you to grant read-only access to Docs, Sheets, and Drive
3. Save the refresh token to `.credentials/tokens.json`

### 4. Run the Server

The server supports two transport modes:

#### HTTP Mode (Default)

```bash
# Start with HTTP transport (default, port 12333)
bun run start

# Or explicitly
bun run start --http

# Custom port via environment variable
MCP_PORT=8080 bun run start
```

#### Stdio Mode

```bash
# Start with stdio transport (for MCP clients that use stdio)
bun run start --stdio
```

### 5. Configure Your MCP Client

#### Claude Desktop (stdio mode)

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "bun",
      "args": ["run", "/path/to/google-docs-mcp/src/index.ts", "--stdio"]
    }
  }
}
```

#### Claude Code (stdio mode)

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "bun",
      "args": ["run", "/path/to/google-docs-mcp/src/index.ts", "--stdio"]
    }
  }
}
```

#### HTTP Mode

For clients that support HTTP transport, connect to:

- **RPC endpoint**: `POST http://localhost:12333/rpc`
- **Health check**: `GET http://localhost:12333/health`

## Environment Variables

| Variable   | Description               | Default |
|------------|---------------------------|---------|
| `MCP_PORT` | Port for HTTP server      | 12333   |
| `PORT`     | Alternative port variable | 12333   |

## Usage Examples

Once configured, you can ask your MCP client to:

- "List my recent Google Docs"
- "Read the document at https://docs.google.com/document/d/ABC123/edit"
- "Show me the data in Sheet1 of my budget spreadsheet"
- "Search for documents containing 'project proposal'"

## File Structure

```
google-docs-mcp/
├── client_secret.json     # Your Google OAuth credentials (git-ignored)
├── .credentials/          # Stored tokens (git-ignored)
│   └── tokens.json
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── auth/
│   │   └── oauth.ts       # OAuth2 client management
│   ├── tools/
│   │   ├── docs.ts        # Google Docs tools
│   │   └── sheets.ts      # Google Sheets tools
│   └── types/
│       └── index.ts       # TypeScript types
└── bin/
    └── auth.ts            # CLI authentication script
```

## Re-authenticating

If you need to re-authenticate (e.g., token expired or want to use a different account):

```bash
rm -rf .credentials
bun run auth
```

## Troubleshooting

### "Google credentials not found"

Make sure `client_secret.json` is in the project root directory.

### "Not authenticated"

Run `bun run auth` to complete the OAuth flow.

### "Access denied" errors

Ensure you've enabled the required APIs in Google Cloud Console and added your email as a test user in the OAuth consent screen.

### Token expired

For apps in "Testing" status, refresh tokens may expire after 7 days. Re-run `bun run auth` to get a new token, or publish your app in Google Cloud Console for longer-lived tokens.

## License

MIT
