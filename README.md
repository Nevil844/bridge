# 🌉 Bridge AI

A beautiful mobile AI chat app with dynamic MCP (Model Context Protocol) integrations. Think Claude Desktop, but for mobile! 📱✨

## ✨ Key Features

- **🔗 Dynamic Integrations** - Users add their own GitHub, Slack, etc. from the app
- **🎯 OAuth Flow** - Simple "Connect with GitHub" button - no manual tokens!
- **🤖 6 AI Models** - GPT-4, Claude 3, Gemini Pro, and more
- **💫 Beautiful UI** - Glowing Siri-style orb, smooth animations
- **🌓 Dark Mode** - Automatic theme support
- **📱 Mobile-First** - Built with React Native/Expo

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Console account (for OAuth)
- PostgreSQL database with pgvector extension

### 1. Google OAuth Setup (Required for Login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `http://localhost:3000/api/auth/google/callback`
4. Copy your Client ID and Client Secret

📖 **Detailed guide:** See [OAUTH_SETUP.md](./OAUTH_SETUP.md)

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file from example
cp env.example .env

# Edit .env and add:
# - DATABASE_URL (PostgreSQL connection string)
# - GOOGLE_AUTH_CLIENT_ID (from step 1)
# - GOOGLE_AUTH_CLIENT_SECRET (from step 1)
# - GEMINI_API_KEY (optional, for Gemini models)
# - OPENROUTER_API_KEY (optional, for additional models)

# Set up database and run migrations
./scripts/setup-db.sh  # Or manually create database
npm run migrate

# Start the backend server
npm start
```

Backend runs on `http://localhost:3000`

### 3. Frontend Setup

```bash
# From project root
npm install

# Start the development server
npm start

# Then:
# - Press 'i' for iOS simulator
# - Or scan QR code with Expo Go for physical device
```

### 4. Connect GitHub!

1. Open app → Integrations tab
2. Tap "Connect" on GitHub
3. Browser opens → Click "Authorize"
4. Done! Green badge appears in Chat

## 💬 Try It Out

With GitHub connected, ask:
- "Show me popular React repositories"
- "What's in the facebook/react README?"
- "Find Python AI projects"

The AI fetches **real live data** from GitHub! 🔥

## 📖 Documentation

- **[OAUTH_SETUP.md](./OAUTH_SETUP.md)** - Detailed OAuth setup guide
- **[USER_GUIDE.md](./USER_GUIDE.md)** - Complete user guide
- **[backend/README.md](./backend/README.md)** - Backend architecture

## 🏗️ Architecture

```
Mobile App (React Native/Expo)
    ↓
Backend API (Express)
    ↓
User MCP Manager (Per-user connections)
    ↓
MCP Servers (GitHub, Slack, etc.)
    ↓
External APIs
```

**Key Design:**
- Each user manages their own integrations
- OAuth for easy authorization
- Credentials stored securely on backend
- Extensible - easy to add new integrations

## 🎨 UI/UX Highlights

- **Glowing Orb** - Beautiful animated Siri-style orb
- **Model Selector** - Quick dropdown to switch AI models
- **Integration Cards** - Clean GitHub logo, connection status
- **OAuth Flow** - Seamless browser-based authorization
- **Status Badge** - Green "MCP Connected" indicator
- **Loading States** - Smooth animations throughout

## 🔒 Security

✅ OAuth instead of manual tokens  
✅ Per-user credential isolation  
✅ State parameter for CSRF protection  
✅ Tokens never sent to mobile app  
✅ Easy to revoke access  

## 🛠️ Tech Stack

**Frontend:**
- React Native + Expo
- TypeScript
- AsyncStorage for preferences
- Reanimated for animations

**Backend:**
- Express.js
- MCP SDK (@modelcontextprotocol/sdk)
- OAuth 2.0 flow
- Per-user MCP connections

## 📱 Supported Integrations

### Currently Available:
- ✅ **GitHub** - Full OAuth flow, MCP server integration

### Coming Soon:
- 🚧 Slack
- 🚧 Google Drive
- 🚧 Notion
- 🚧 Filesystem
- 🚧 Custom MCP servers

## 🤝 Contributing

This is a reference implementation showing how to build a Claude Desktop-style app. Feel free to:
- Add more MCP servers
- Improve UI/UX
- Add features (voice, images, etc.)
- Deploy to production

## 📝 Key Files

```
bridge-ai/
├── app/(tabs)/
│   ├── index.tsx          # Chat screen
│   ├── integrations.tsx   # Integration management
│   └── settings.tsx       # App settings
├── backend/
│   ├── server.js           # Express server
│   ├── user-mcp-manager.js # Per-user MCP connections
│   └── oauth-handler.js    # OAuth flow logic
├── components/
│   └── glowing-orb.tsx    # Animated orb
└── config/
    └── api.ts             # API configuration
```

## 🎯 Comparison with Claude Desktop

| Feature | Claude Desktop | This App |
|---------|----------------|----------|
| Dynamic Integrations | ✅ | ✅ |
| User adds MCP servers | ✅ | ✅ |
| OAuth flow | ✅ | ✅ |
| Per-user connections | ✅ | ✅ |
| Mobile app | ❌ | ✅ |
| Multiple AI models | ❌ | ✅ (6 models) |
| Open source | ❌ | ✅ |

## 🐛 Troubleshooting

### "Could not connect to server"
- Ensure backend is running
- Check `config/api.ts` has correct IP
- Both devices on same WiFi

### OAuth not working
- Verify GitHub OAuth app credentials
- Check callback URL matches
- See `OAUTH_SETUP.md` for details

### MCP not connecting
- Check backend logs for errors
- Verify user completed OAuth flow
- Try disconnecting and reconnecting

## 📄 License

MIT - Feel free to use in your own projects!

## 🌟 Star This Repo

If you found this helpful, give it a star! ⭐

## 💡 Inspiration

Built with inspiration from:
- Claude Desktop (Anthropic)
- ChatGPT mobile app (OpenAI)
- Model Context Protocol (MCP)

---

**Happy chatting with your AI assistant!** 🎉

For detailed setup instructions, see [OAUTH_SETUP.md](./OAUTH_SETUP.md)
