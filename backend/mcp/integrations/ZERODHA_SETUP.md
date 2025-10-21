# Zerodha/Kite MCP Integration Setup

This integration allows you to access your Zerodha portfolio, market data, and trading insights through the MCP protocol using [Zerodha's official Kite MCP server](https://zerodha.com/z-connect/featured/connect-your-zerodha-account-to-ai-assistants-with-kite-mcp).

## Features

The Zerodha integration provides access to Zerodha's official MCP tools for:

- **Portfolio Analysis**: View positions, holdings, and P&L
- **Market Data**: Get real-time quotes, historical data, and market information
- **Research Tools**: Analyze stocks, technical indicators, and correlations
- **Account Information**: Check margins, buying power, and account details

**Note**: The available tools are provided by Zerodha's MCP server. Order placement and some other features may have limited availability.

## Prerequisites

1. **Zerodha Account**: You need an active Zerodha trading account
2. **Kite Connect App**: Register for a Kite Connect app at https://developers.kite.trade/
3. **Node.js**: Required to run the MCP remote server (for connecting to Zerodha's remote MCP)

## Setup Instructions

### 1. Create a Kite Connect App

1. Visit https://developers.kite.trade/
2. Log in with your Zerodha credentials
3. Click "Create new app"
4. Fill in the app details:
   - **App name**: Your app name (e.g., "AI MCP Assistant")
   - **Redirect URL**: `http://localhost:3000/api/oauth/callback`
     - Note: Our system adds query parameters to this URL (e.g., `?state=xxx&integration=zerodha`)
     - Make sure your Kite app accepts URLs with query parameters
   - **Type**: Connect
5. Submit and note down your **API Key** and **API Secret**

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Zerodha/Kite Connect Configuration
ZERODHA_API_KEY=your_api_key_here
ZERODHA_API_SECRET=your_api_secret_here
ZERODHA_REDIRECT_URI=http://localhost:3000/api/oauth/callback
```

### 3. Install Dependencies

The integration uses `mcp-remote` to connect to Zerodha's remote MCP server. It will be automatically installed via npx when needed.

### 4. Authentication Flow

Unlike other integrations, Zerodha access tokens:
- **Expire daily** at 7:30 AM IST
- **Cannot be refreshed** - users must re-authenticate each day
- Are obtained through Zerodha's OAuth 2.0 flow

## Using the Integration

### Connect Zerodha

1. Navigate to the **Integrations** tab in your app
2. Click "Connect" on the Zerodha integration
3. You'll be redirected to Zerodha's login page
4. Log in and authorize the app
5. You'll be redirected back with a success message

### First-Time MCP Session Login

**IMPORTANT**: After connecting Zerodha via OAuth, you need to complete an additional MCP session login the first time you ask a Zerodha-related question.

#### How it works:

1. **Ask any Zerodha question** (e.g., "What's my Zerodha portfolio?")
2. **The AI will show you**:
   - ⚠️ A warning about AI systems being unpredictable
   - 🔗 A clickable login link to authorize the MCP session
3. **Click the link** to authorize on Zerodha's website
4. **Come back and ask your question again** - now the AI can access your data!

#### Why this extra step?

Zerodha's MCP server requires explicit user consent beyond the OAuth token. This is a security feature to ensure users understand they're granting AI access to their trading account.

#### Session expiry:

- MCP sessions may expire after some time
- If you get "Failed to execute" errors, the AI will ask you to login again
- Simply click the new login link provided

### Example AI Prompts

Once you've completed the MCP login, you can ask your AI assistant:

#### Portfolio Analysis
- "Show me my Zerodha portfolio"
- "What are my current holdings?"
- "Which positions are profitable today?"
- "Analyze my sector exposure"
- "Show me unrealized P&L by holding"

#### Market Research
- "Get current price for RELIANCE"
- "Show me today's top gainers in Nifty 50"
- "Compare TCS and INFY stock performance"
- "What's the historical data for HDFC Bank for last month?"
- "Show correlation between my holdings and Nifty"

#### Account Information
- "What's my available margin?"
- "Show my account P&L for today"
- "What's my buying power?"

#### Technical Analysis
- "Calculate RSI for TATAMOTORS"
- "Show moving averages for ITC"
- "Plot my portfolio performance against Nifty 500"

## Available Tools

The exact tools available depend on Zerodha's MCP server implementation. Common tools include:

- Portfolio data retrieval
- Market quotes and prices
- Historical data access
- Technical indicators
- Account and margin information
- Holdings and positions data

**Note**: Tool availability and names may vary. Use the MCP status endpoint to see the current list of available tools.

## Important Notes

### Token Expiration
- Zerodha access tokens expire **daily at 7:30 AM IST**
- Users must re-authenticate each day
- The app will show the integration as disconnected when the token expires
- Simply click "Connect" again to re-authenticate

### API Limits
- Zerodha has rate limits on API calls
- Historical data access may be subject to limits based on your subscription
- See [Kite Connect documentation](https://kite.trade/docs/connect/v3/) for details

### Security
- Access tokens are stored encrypted in your local database
- All API calls use HTTPS
- You can revoke access anytime from your [Kite Connect apps](https://kite.zerodha.com/apps)

### Free Access
- As announced by Zerodha, MCP access is **completely free**
- No additional charges beyond your regular Zerodha account fees
- Similar to Kite Connect APIs which are also now free

## Troubleshooting

### "Invalid or expired token"
- Zerodha tokens expire daily - simply re-authenticate
- Check that your API Key and Secret are correct

### "Cannot connect to MCP server"
- Ensure `mcp-remote` package can be installed (requires internet access)
- Check that Node.js is properly installed
- Verify your network allows connections to `mcp.kite.trade`

### "OAuth failed" or "Missing authorization code or state"
- **Zerodha OAuth quirk**: Kite Connect doesn't return the `state` parameter in the standard way
- **Our solution**: We encode the state in the redirect URL itself (e.g., `callback?state=xxx&integration=zerodha`)
- Verify your Kite Connect app allows the callback URL pattern: `http://localhost:3000/api/oauth/callback*`
- The redirect URI in your Kite app should be: `http://localhost:3000/api/oauth/callback` (without query parameters)
- Ensure your Kite Connect app is active
- Check that API Key and Secret are correct

### Tools not showing up
- Wait a few seconds after connecting for the MCP server to initialize
- Try disconnecting and reconnecting
- Check the backend logs for connection errors

## Resources

- [Zerodha MCP Announcement](https://zerodha.com/z-connect/featured/connect-your-zerodha-account-to-ai-assistants-with-kite-mcp)
- [Kite Connect Documentation](https://kite.trade/docs/connect/v3/)
- [Kite Connect Developer Portal](https://developers.kite.trade/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

## Support

For integration-related issues:
- Check the backend server logs
- Verify your environment variables
- Ensure your Kite Connect app is properly configured

For Zerodha API or MCP server issues:
- Visit [Kite Connect Support](https://kite.trade/support)
- Check [Zerodha Trading Q&A](https://tradingqna.com/)

