# Multi-AI Browser Extension

A production-ready browser extension that provides unified access to multiple AI providers (Claude, ChatGPT, Gemini, Grok) with intelligent routing, cost optimization, and seamless context sharing.

## Features

### 🤖 Multi-AI Provider Support
- **Claude (Anthropic)** - Best for creative writing, analysis, and reasoning
- **ChatGPT (OpenAI)** - Excellent for code generation and technical documentation
- **Gemini (Google)** - Great for research and real-time information
- **Grok (xAI)** - Fast responses with social media integration

### 🧠 Intelligent AI Routing
- Automatic routing to the best AI based on task type
- Learning system that adapts to user preferences
- Manual override always available
- Scoring algorithm considers:
  - Task capability match (40%)
  - User preferences (30%)
  - Cost efficiency (20%)
  - Response speed (10%)

### 📝 Context Management
- Multiple context modes:
  - Selection only
  - Visible content
  - Full page HTML
  - Multi-tab context
- Smart truncation for token limits
- Privacy-aware with domain exclusions

### 💼 Advanced Features
- **Secure API Key Storage** - AES-256 encryption
- **Cost Tracking** - Monitor usage and set budget alerts
- **Streaming Responses** - Real-time AI responses
- **Conversation History** - Save and search past interactions
- **Prompt Library** - 50+ built-in templates
- **Cross-AI Comparison** - Send same prompt to multiple AIs
- **Command Palette** - Quick access with Cmd/Ctrl+Shift+K

## Installation

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/JonSnow1807/multi-ai-browser-extension.git
cd multi-ai-browser-extension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Production Build

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

## Usage

### Setting up API Keys

1. Click the extension icon and go to Settings
2. Enter your API keys for each provider:
   - Claude: Get from [Anthropic Console](https://console.anthropic.com/)
   - ChatGPT: Get from [OpenAI Platform](https://platform.openai.com/)
   - Gemini: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Grok: Get from [x.AI](https://x.ai/)

### Keyboard Shortcuts

- **Cmd/Ctrl + Shift + A** - Toggle AI sidebar
- **Cmd/Ctrl + Shift + K** - Open command palette
- **Cmd/Ctrl + Shift + Space** - Quick ask with selection

### Context Menu

Right-click on any page or selected text:
- Ask specific AI (Claude, ChatGPT, Gemini, Grok)
- Ask all AIs (compare responses)
- Custom prompt

## Project Structure

```
multi-ai-browser-extension/
├── src/
│   ├── background/          # Background service worker
│   │   ├── index.ts        # Main background script
│   │   ├── aiRouter.ts     # Intelligent routing logic
│   │   ├── apiManager.ts   # API request handling
│   │   └── contextManager.ts # Context extraction
│   ├── content/            # Content scripts
│   ├── popup/              # Extension popup UI
│   ├── options/            # Settings page
│   ├── components/         # React components
│   ├── services/           # AI provider clients
│   │   ├── anthropic.ts   # Claude API
│   │   ├── openai.ts      # ChatGPT API
│   │   ├── google.ts      # Gemini API
│   │   └── xai.ts         # Grok API
│   ├── types/              # TypeScript definitions
│   └── utils/              # Helper functions
├── public/                 # Static assets
│   ├── manifest.json      # Extension manifest
│   └── icons/             # Extension icons
└── dist/                  # Build output
```

## Development

### Available Scripts

- `npm run dev` - Start development build with watch mode
- `npm run build` - Create production build
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

### Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Webpack 5
- **State Management**: Zustand
- **Icons**: Lucide React
- **API Client**: Axios
- **Extension API**: Chrome Extension Manifest V3

## Security

- API keys are encrypted using Web Crypto API (AES-256-GCM)
- No telemetry or tracking by default
- Domain exclusion for sensitive sites
- Secure master password system
- Input sanitization for all user inputs

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Chinmay Shrivastava** (GitHub: [@JonSnow1807](https://github.com/JonSnow1807))

## Acknowledgments

- Built with Chrome Extension Manifest V3
- Uses official APIs from Anthropic, OpenAI, Google, and xAI
- Icons from Lucide React

## Status

🚧 **In Active Development** - Core infrastructure complete, UI components in progress

### Completed
- ✅ Project setup and configuration
- ✅ TypeScript type definitions
- ✅ Encryption service for API keys
- ✅ Storage service with caching
- ✅ Background service worker
- ✅ AI routing algorithm
- ✅ API clients for all providers
- ✅ Context management system

### In Progress
- 🔄 UI components (sidebar, popup, options)
- 🔄 Advanced features implementation
- 🔄 Testing and documentation

## Support

For issues and questions, please [open an issue](https://github.com/JonSnow1807/multi-ai-browser-extension/issues) on GitHub.