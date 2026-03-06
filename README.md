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
- [Expo Go](https://expo.dev/go) app installed on your iOS or Android device

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

Then scan the QR code with **Expo Go** on your phone, or press `a` for Android emulator / `i` for iOS simulator.

---

## Testing on Linux with a Physical iOS Device

iOS simulators are only available on macOS, but you can fully test the app on a **real iPhone** from Linux using the **Expo Go** app and either LAN mode or tunnel mode.

### Step 1 — Install Prerequisites

```bash
# Node.js 18+ (if not already installed)
# Ubuntu/Debian:
sudo apt update && sudo apt install -y nodejs npm

# Or use nvm:
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20 && nvm use 20
```

> **Note:** Tunnel mode uses `@expo/ngrok` — it is already installed as a dependency via `npm install`.

### Step 2 — Install Expo Go on your iPhone

Download **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779) on your iPhone.

### Step 3 — Start the dev server

#### Option A — LAN mode (fastest, requires same Wi-Fi)

Your iPhone and Linux machine must be on the **same Wi-Fi network**.

```bash
npm run start:lan
```

Scan the QR code shown in your terminal with the **Camera app** on iPhone (or from within Expo Go).

#### Option B — Tunnel mode (works on any network)

Tunnel mode routes traffic through Expo's servers, so your phone and machine do **not** need to be on the same network. This is useful when the phone is on cellular or on a different network.

```bash
npm run start:tunnel
```

> Tunnel mode uses `@expo/ngrok` (already installed) to create a secure tunnel. The first run may take 10–20 seconds to establish the tunnel.

Scan the QR code from the Expo Go app on your iPhone.

### Step 4 — (Optional) Connect to a local AI server from your iPhone

When testing with a **physical device**, `localhost` refers to the phone itself, not your Linux machine. Use your machine's LAN IP instead.

```bash
# Find your Linux machine's IP address
ip addr show | grep 'inet ' | grep -v '127.0.0.1'
# Example output: inet 192.168.1.42/24 ...
```

Then in the app's Settings tab, update provider Base URLs:
- Ollama: `http://192.168.1.42:11434`
- vLLM: `http://192.168.1.42:8000`

**Ensure your AI server binds to `0.0.0.0`** (not just `127.0.0.1`):

```bash
# Ollama
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# vLLM
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-8B-Instruct \
  --host 0.0.0.0 --port 8000
```

You may also need to open the ports in your Linux firewall:

```bash
sudo ufw allow 11434/tcp   # Ollama
sudo ufw allow 8000/tcp    # vLLM
```

### Available dev scripts

| Command | Description |
|---|---|
| `npm start` | Start Metro bundler (auto-detects network) |
| `npm run start:lan` | LAN mode — fastest, requires same Wi-Fi |
| `npm run start:tunnel` | Tunnel mode — works on any network |
| `npm run ts:check` | Type-check without building |

---

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
