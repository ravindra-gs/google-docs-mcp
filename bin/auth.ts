#!/usr/bin/env bun

import { GoogleOAuth } from "../src/auth/oauth.js";

const PORT = 3000;

async function runAuthFlow() {
  console.log("Google OAuth2 Authentication\n");

  let oauth: GoogleOAuth;
  try {
    oauth = new GoogleOAuth({
      redirectUri: `http://localhost:${PORT}/oauth2callback`,
    });
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    console.error("\nTo set up credentials:");
    console.error("  1. Go to https://console.cloud.google.com/");
    console.error("  2. Create OAuth 2.0 credentials (Desktop application)");
    console.error("  3. Download and save as 'client_secret.json' in the project root");
    process.exit(1);
  }

  // Check if already authenticated
  const alreadyAuthenticated = await oauth.loadTokens();
  if (alreadyAuthenticated) {
    console.log("Already authenticated!");
    console.log("To re-authenticate, delete the .credentials folder and run again.");
    process.exit(0);
  }

  const authUrl = oauth.getAuthUrl();

  console.log("Opening browser for authentication...\n");
  console.log("If the browser doesn't open, visit this URL manually:");
  console.log(`\n${authUrl}\n`);

  // Try to open the browser
  try {
    const proc = Bun.spawn(["xdg-open", authUrl], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await proc.exited;
  } catch {
    // Fallback for macOS
    try {
      const proc = Bun.spawn(["open", authUrl], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await proc.exited;
    } catch {
      // Browser couldn't be opened, user will use the URL
    }
  }

  // Start local server to receive callback
  console.log(`Waiting for authentication callback on port ${PORT}...`);

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/oauth2callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          console.error(`\nAuthentication error: ${error}`);
          server.stop();
          process.exit(1);
        }

        if (!code) {
          return new Response("No authorization code received", { status: 400 });
        }

        try {
          await oauth.exchangeCodeForTokens(code);
          console.log("\nAuthentication successful!");
          console.log("Tokens saved to .credentials/tokens.json");
          console.log("You can now use the MCP server.");

          // Delay shutdown to allow response to be sent
          setTimeout(() => {
            server.stop();
            process.exit(0);
          }, 500);

          return new Response(
            `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Authentication Successful</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #f5f5f5;
                  }
                  .container {
                    text-align: center;
                    padding: 2rem;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  h1 { color: #22c55e; }
                  p { color: #666; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>Authentication Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </div>
              </body>
            </html>
          `,
            {
              headers: { "Content-Type": "text/html" },
            }
          );
        } catch (err) {
          console.error("\nFailed to exchange code for tokens:", err);
          server.stop();
          process.exit(1);
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Server listening on http://localhost:${PORT}`);
}

runAuthFlow().catch((err) => {
  console.error("Authentication failed:", err);
  process.exit(1);
});
