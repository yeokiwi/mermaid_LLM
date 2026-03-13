# LLM-to-Mermaid Diagram Generator with MCP Agent

A Node.js application that provides an end-to-end pipeline for generating Mermaid diagrams from natural language queries and source code analysis. Powered by DeepSeek LLM, Model Context Protocol (MCP), and Mermaid.js.

## Features

- **Natural Language to Diagram** — Describe a diagram in plain English and get a rendered SVG/PNG
- **Source Code to Diagram** — Browse local directories, select source files, and auto-generate class diagrams, flowcharts, ER diagrams, and more from the actual code structure
- **15 Diagram Types** — Flowchart, sequence, class, state, ER, Gantt, pie, gitGraph, mindmap, timeline, quadrant, sankey, XY chart, block, and architecture diagrams
- **Agentic Tool-Use Loop** — The LLM autonomously decides which MCP tools to invoke (validate, render, fetch templates), inspects results, and retries on errors
- **Live Streaming** — SSE-based real-time token delivery with tool-call status indicators
- **Code Parser** — Regex-based extraction for C#, C++, Python, JavaScript, and TypeScript (classes, methods, inheritance, imports, dependencies)
- **Dark-Themed UI** — Two-panel web interface with chat, directory browser, code preview, inline diagrams, and a diagram gallery

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (Dark UI)                       │
│  ┌───────────────────┐  ┌─────────────────────────────┐ │
│  │  Chat Panel (SSE) │  │  Directory Browser / Preview │ │
│  │  [user message]   │  │  📁 /home/user/project       │
│  │  [LLM response]   │  │   ├── src/                   │
│  │  [rendered SVG]    │  │   │   ├── User.cs            │
│  └───────────────────┘  └─────────────────────────────┘ │
└───────────────┬─────────────────────────────────────────┘
                │ HTTP / SSE
                ▼
┌─────────────────────────────────────────────────────────┐
│                Express.js Backend                        │
│  POST /api/chat   GET /api/browse   POST /api/parse     │
│  GET /api/file    GET/POST /api/diagram                  │
│         │                                                │
│         ▼                                                │
│  ┌─────────────────┐    ┌────────────────────┐          │
│  │  MCP Client      │    │  Source Code Parser │          │
│  │  (stdio)         │    │  (regex fallback)   │          │
│  └────────┬─────────┘    └────────────────────┘          │
│           ▼                                              │
│  ┌──────────────────────────────┐                        │
│  │  Mermaid MCP Server          │                        │
│  │  Tools: render_diagram,      │                        │
│  │    validate_syntax,          │                        │
│  │    list_diagram_types,       │                        │
│  │    get_diagram_template      │                        │
│  └──────────────────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 20 LTS |
| LLM Provider | DeepSeek API (OpenAI-compatible) |
| MCP Framework | `@modelcontextprotocol/sdk` |
| Mermaid Rendering | `@mermaid-js/mermaid-cli` (mmdc) |
| Web Framework | Express.js |
| Streaming | Server-Sent Events (SSE) |
| Frontend | Vanilla HTML + CSS + JavaScript |
| Code Parsing | Regex-based extraction (5 languages) |

## Prerequisites

- **Node.js** >= 20 LTS
- **npm** (comes with Node.js)
- A **DeepSeek API key** — obtain one from [DeepSeek Platform](https://platform.deepseek.com/)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yeokiwi/mermaid_LLM.git
   cd mermaid_LLM
   ```

2. **Install dependencies**

   Puppeteer (used internally by mermaid-cli) may attempt to download a Chromium binary. If that fails in your environment, skip it:

   ```bash
   npm install
   ```

   Or if Chromium download fails:

   ```bash
   PUPPETEER_SKIP_DOWNLOAD=true npm install
   ```

3. **Create the environment file**

   ```bash
   cp .env.example .env
   ```

4. **Configure your API key**

   Edit `.env` and set your DeepSeek API key:

   ```env
   DEEPSEEK_API_KEY=sk-your-api-key-here
   ```

## Configuration

All configuration is managed through environment variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | *(required)* | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | API endpoint (change for compatible providers) |
| `DEEPSEEK_MODEL` | `deepseek-chat` | LLM model identifier |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `ALLOWED_ROOTS` | User home directory | Comma-separated allowed directories for file browsing |
| `MAX_FILE_SIZE_MB` | `1` | Maximum file size for preview (MB) |
| `MERMAID_THEME` | `dark` | Default Mermaid theme (`dark`, `default`, `forest`, `neutral`) |
| `PARSER_STRATEGY` | `auto` | Code parsing strategy (`auto`, `regex`) |
| `MAX_PARSE_FILES` | `200` | Maximum files to parse per request |
| `MAX_PARSE_DEPTH` | `10` | Maximum directory recursion depth |

## Running the Application

### Production

```bash
npm start
```

### Development (auto-reload on file changes)

```bash
npm run dev
```

The server starts with this sequence:
1. Loads and validates configuration (fails fast if `DEEPSEEK_API_KEY` is missing)
2. Spawns the MCP server as a child process
3. Connects the MCP client via stdio transport and discovers tools
4. Tests the MCP connection
5. Starts the Express server

Once running, open your browser to:

```
http://localhost:3000
```

### Running the MCP Server Standalone

For debugging the MCP server in isolation:

```bash
npm run mcp-server
```

## Usage

### Natural Language Diagrams

Type a natural language request in the chat panel:

- *"Create a sequence diagram showing OAuth2 login flow"*
- *"Draw a class diagram for a user management system"*
- *"Make an ER diagram for an e-commerce database"*
- *"Create a flowchart for CI/CD pipeline"*

The LLM will generate Mermaid syntax, validate it, render it as SVG, and display it inline.

### Source Code Diagrams

1. In the **Directory Browser** (right panel), enter a directory path and click **Go**
2. Browse directories and select source files using checkboxes
3. Use language filters (C#, C++, Python, JS, TS) to narrow the file list
4. Click **Parse & Attach to Chat** to analyze the selected code
5. Ask the LLM: *"Generate a class diagram for the selected code"*

The parser extracts classes, methods, properties, inheritance, and dependencies, then feeds that context to the LLM for diagram synthesis.

### Editing Diagrams

Each rendered diagram has an action bar with:

- **Full Screen** — View the diagram in a modal overlay
- **Download SVG** — Save the raw SVG file
- **Download PNG** — Render and download as PNG
- **Copy Syntax** — Copy the Mermaid source to clipboard
- **Edit** — Open a syntax editor, modify the diagram, and re-render

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Chat with LLM via SSE stream |
| `GET` | `/api/browse?path=` | List directory contents |
| `GET` | `/api/file?path=` | Read file content |
| `POST` | `/api/parse` | Parse source code structure |
| `GET` | `/api/diagram/types` | List supported diagram types |
| `POST` | `/api/diagram/render` | Render Mermaid syntax directly |
| `GET` | `/api/health` | Server health check |

## Project Structure

```
llm-mermaid-mcp/
├── package.json
├── .env.example
├── config.js                  # Centralized configuration loader
├── src/
│   ├── mcp-server/
│   │   ├── server.js          # MCP server entry point
│   │   ├── tools/             # render-diagram, validate-syntax, etc.
│   │   ├── resources/         # MCP resource handlers
│   │   └── templates/         # .mmd template files
│   ├── mcp-client/
│   │   └── client.js          # MCP client with auto-reconnect
│   ├── llm/
│   │   ├── deepseek.js        # DeepSeek API integration
│   │   ├── system-prompt.js   # LLM system prompt
│   │   └── tool-loop.js       # Agentic tool-use loop + SSE writer
│   ├── parser/
│   │   ├── index.js           # Parser orchestrator
│   │   ├── common.js          # File discovery + utilities
│   │   ├── context-builder.js # LLM context summarizer
│   │   └── languages/         # C#, C++, Python, JS, TS parsers
│   └── server/
│       ├── index.js           # Express app entry point
│       ├── routes/            # chat, browse, parse, diagram, file
│       └── middleware/        # security, error-handler
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/                    # app, chat, browser, diagram, utils
└── output/diagrams/           # Rendered diagram output directory
```

## Security

- **API key protection** — `DEEPSEEK_API_KEY` is never exposed to the frontend
- **Path sandboxing** — File browsing is restricted to `ALLOWED_ROOTS` with path traversal blocking
- **SVG sanitization** — Script tags and event handlers are stripped from rendered SVGs
- **Rate limiting** — 20 requests/minute per IP on the chat endpoint
- **File size limits** — Files exceeding `MAX_FILE_SIZE_MB` are rejected
- **System directory blocking** — `/etc`, `/usr`, `/var`, `/sys`, `/proc`, `/dev` are always blocked

## License

ISC
