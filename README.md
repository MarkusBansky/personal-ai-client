# Personal AI Client

A mobile app (iOS & Android) built with **Expo** and **React Native** that connects to multiple AI backends — vLLM, Ollama, OpenAI, Anthropic, Mistral, and any OpenAI-compatible API.

## Features

- **Multiple AI Providers** — Connect to local vLLM / Ollama instances or cloud APIs (OpenAI, Anthropic, Mistral)
- **Three Built-in Agents** — Chat, Researcher, and Coding assistant with tailored system prompts
- **Custom Agents** — Create unlimited custom agents with custom names, icons, descriptions, and system prompts
- **Streaming Responses** — Token-by-token streaming from all supported providers
- **Conversation History** — Persistent chat history stored locally on device
- **Dark Theme** — Native dark UI with clean, minimal design
- **No backend required** — All data stored locally using AsyncStorage

## Tech Stack

| Technology | Purpose |
|---|---|
| [Expo SDK 55](https://expo.dev) | Cross-platform mobile framework |
| [React Native 0.83](https://reactnative.dev) | Native UI components |
| [React Navigation 6](https://reactnavigation.org) | Tab + stack navigation |
| [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) | Local persistent storage |
| TypeScript | Type safety |

## Supported AI Providers

| Provider | Type | Notes |
|---|---|---|
| **Ollama** | Local | Default: `http://localhost:11434` |
| **vLLM** | Local | Default: `http://localhost:8000` |
| **OpenAI** | Cloud | API key required |
| **Anthropic** | Cloud | API key required |
| **Mistral AI** | Cloud | API key required |
| **Custom** | Any | OpenAI-compatible API endpoint |

## Getting Started

### Prerequisites

- Node.js 18+
- [Expo Go](https://expo.dev/go) app on your phone **or** Android/iOS simulator

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

Then scan the QR code with **Expo Go** on your phone, or press `a` for Android emulator / `i` for iOS simulator.

### Connecting to a Local Server

#### Ollama
```bash
# Start Ollama (must bind to 0.0.0.0 so your phone can reach it)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

#### vLLM
```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --host 0.0.0.0 --port 8000
```

**Network tip:** When running on a physical device, replace `localhost` with your machine's local IP address (e.g. `192.168.1.100`). For Android emulator use `10.0.2.2`.

### Configuration

1. Open the app and go to the **Settings** tab (⚙️)
2. Expand any provider card and fill in:
   - **Base URL** — the full URL of your AI server
   - **Model** — model name to use
   - **API Key** — required for cloud providers
3. Tap **Save**

### Creating a Custom Agent

1. Go to the **Agents** tab (🤖)
2. Tap **+ New Agent**
3. Pick an icon, fill in name/description
4. Choose **Agent Type** (Chat / Researcher / Coding / Custom)
5. Select the provider to use
6. Customize the **System Prompt**
7. Tap **Create Agent**

## Project Structure

```
├── App.tsx                    # Root component with navigation
├── app.json                   # Expo configuration
├── index.ts                   # Entry point
├── src/
│   ├── types/index.ts         # TypeScript types
│   ├── constants/index.ts     # Colors, default agents & providers
│   ├── services/
│   │   ├── storage.ts         # AsyncStorage helpers
│   │   └── ai/index.ts        # AI provider clients (streaming)
│   └── screens/
│       ├── AgentsScreen.tsx   # Agent list & launcher
│       ├── ChatScreen.tsx     # Streaming chat UI
│       ├── EditAgentScreen.tsx # Create/edit agents
│       ├── HistoryScreen.tsx  # Conversation history
│       └── SettingsScreen.tsx # Provider configuration
└── assets/                    # App icons & splash screen
```

## License

MIT
