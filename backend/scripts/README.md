# Model Testing Script

This script tests all available AI models in the application to verify they are working correctly.

## Prerequisites

1. **Start the backend server**:
   ```bash
   cd backend
   npm run dev
   ```

2. Ensure your `.env` file is configured with the necessary API keys:
   - `GOOGLE_GEMINI_API_KEY` (for Gemini models)
   - `OPENROUTER_API_KEY` (for OpenRouter models)
   - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (for Bedrock models)

## Usage

### Basic Usage

Test all models using non-streaming requests:

```bash
npm run test:models
```

Or directly:

```bash
node scripts/test-models.js
```

### With Custom Base URL

If your server is running on a different URL:

```bash
node scripts/test-models.js --base-url http://localhost:3000
```

### With Streaming

Test models using streaming responses:

```bash
npm run test:models:stream
```

Or:

```bash
node scripts/test-models.js --stream
```

## What It Does

1. Fetches all available models from `/api/models`
2. Tests each model with a simple prompt: "Say 'Hello, I am working!' in exactly 5 words."
3. Reports success/failure for each model
4. Provides a summary grouped by provider
5. Shows response times and any errors

## Output

The script provides:
- ✅ Success indicators for working models
- ❌ Error messages for failed models
- Response times for each model
- Summary statistics by provider
- Detailed error information for debugging

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║        AI Model Testing Script                    ║
╚════════════════════════════════════════════════════════════╝

Base URL: http://localhost:3000
Test Prompt: "Say 'Hello, I am working!' in exactly 5 words."
Timeout: 30000ms per model

Fetching available models...
✓ Found 15 model(s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provider: GEMINI (3 model(s))
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: Gemini 2.5 Flash (models/gemini-2.5-flash)
Provider: gemini | Tier: free
✓ Success (1234ms)
Response: Hello, I am working!

...

╔════════════════════════════════════════════════════════════╗
║                    Test Summary                        ║
╚════════════════════════════════════════════════════════════╝

Overall Results:
  ✓ Successful: 12
  ✗ Failed: 3
  Total: 15

By Provider:
  gemini: 3/3 (100.0%)
  openrouter: 5/9 (55.6%)
  bedrock: 4/3 (133.3%)
```

## Troubleshooting

### Connection Refused

If you see "Cannot connect to http://localhost:3000":
- Make sure the backend server is running
- Check if the server is running on a different port
- Use `--base-url` to specify the correct URL

### Authentication Errors

If you see authentication errors:
- Check your API keys in the `.env` file
- Ensure the keys are valid and have proper permissions

### Timeout Errors

If models are timing out:
- Check your internet connection
- Verify API keys are valid
- Some models may be slower than others

