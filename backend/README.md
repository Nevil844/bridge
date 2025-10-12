# AI MCP Backend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_api_key_here
PORT=3000
```

3. Get your OpenRouter API key from: https://openrouter.ai/keys

4. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## API Endpoints

- `GET /api/models` - Get available AI models
- `POST /api/chat` - Send a message and get AI response
  - Body: `{ "message": "your message", "model": "model-id" }`

