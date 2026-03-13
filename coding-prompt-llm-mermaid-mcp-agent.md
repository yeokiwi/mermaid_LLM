# LLM-to-Mermaid Diagram Generator with MCP Agent

## Project Overview

Build a Node.js application that provides an end-to-end pipeline for generating Mermaid diagrams from natural language queries and source code analysis. The system consists of three main subsystems:

1. **Mermaid MCP Server** — A Model Context Protocol server that exposes Mermaid diagram generation as MCP tools (text-to-SVG/PNG rendering, syntax validation, template listing).
2. **DeepSeek LLM Chat Frontend** — A dark-themed web UI where users converse with the DeepSeek LLM, request diagrams, and browse/select local source code directories for automated diagram generation.
3. **Source Code Parser** — A backend module that recursively scans user-selected directories containing C#, C++, Python, JavaScript, and TypeScript source files, extracts structural metadata (classes, functions, inheritance, dependencies, call graphs, module relationships), and feeds that metadata to the LLM for Mermaid diagram synthesis.

The LLM acts as the orchestrator: it receives user requests, decides which MCP tools to invoke, optionally ingests parsed source code context, produces Mermaid diagram syntax, and calls the MCP server to render the final diagram — all visible to the user in the chat interface.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 20 LTS |
| Package Manager | npm |
| LLM Provider | DeepSeek API (`https://api.deepseek.com/v1/chat/completions`, model `deepseek-chat`) |
| MCP Framework | `@modelcontextprotocol/sdk` (latest) |
| MCP Transport | Stdio (server ↔ client within process), with SSE endpoint exposed for external tool consumers |
| Mermaid Rendering | `@mermaid-js/mermaid-cli` (mmdc) for server-side SVG/PNG generation |
| Web Framework | Express.js |
| Streaming | Server-Sent Events (SSE) for LLM token streaming to the browser |
| Frontend | Vanilla HTML + CSS + JavaScript (single-page, no framework) |
| Source Parsing | Tree-sitter via `tree-sitter` + language grammars (`tree-sitter-c-sharp`, `tree-sitter-cpp`, `tree-sitter-python`, `tree-sitter-javascript`, `tree-sitter-typescript`) — with regex fallback if Tree-sitter bindings fail to compile |
| File System Browsing | `fs/promises` + chokidar (optional watch) |
| Output Formats | SVG (default), PNG (optional via puppeteer inside mmdc) |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (Dark UI)                        │
│  ┌────────────────────┐  ┌─────────────────────────────────┐ │
│  │  Chat Panel        │  │  Directory Browser / Code View  │ │
│  │  (SSE streaming)   │  │  (tree nav + file preview)      │ │
│  │                    │  │                                  │ │
│  │  [user message]    │  │  📁 /home/user/project           │
│  │  [LLM response]    │  │   ├── 📁 src                    │
│  │  [rendered diagram]│  │   │   ├── Program.cs             │
│  │                    │  │   │   ├── Utils.cpp              │
│  │                    │  │   │   └── main.py                │
│  └────────────────────┘  └─────────────────────────────────┘ │
└──────────────────┬───────────────────────────────────────────┘
                   │ HTTP / SSE
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                   Express.js Backend                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Chat Route   │  │ Directory    │  │ Source Code Parser  │ │
│  │ POST /chat   │  │ API          │  │ (Tree-sitter or    │ │
│  │ GET /chat/   │  │ GET /browse  │  │  regex fallback)   │ │
│  │   stream     │  │ GET /file    │  │                    │ │
│  └──────┬───────┘  └──────────────┘  └────────┬───────────┘ │
│         │                                      │             │
│         ▼                                      │             │
│  ┌──────────────────────────────────┐          │             │
│  │  MCP Client (in-process)         │◄─────────┘             │
│  │  Connects to MCP Server via stdio│                        │
│  └──────────┬───────────────────────┘                        │
│             │ stdio                                          │
│             ▼                                                │
│  ┌──────────────────────────────────┐                        │
│  │  Mermaid MCP Server              │                        │
│  │  Tools:                          │                        │
│  │   - render_diagram               │                        │
│  │   - validate_syntax              │                        │
│  │   - list_diagram_types           │                        │
│  │   - get_diagram_template         │                        │
│  │  Resources:                      │                        │
│  │   - mermaid://templates/{type}   │                        │
│  └──────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Specifications

### 1. Mermaid MCP Server (`src/mcp-server/`)

#### 1.1 Server Setup

- File: `src/mcp-server/server.js`
- Create an MCP server using `@modelcontextprotocol/sdk/server` with `StdioServerTransport`.
- Server name: `mermaid-diagram-server`, version `1.0.0`.
- Register the following tools and resources on startup.

#### 1.2 MCP Tools

##### Tool: `render_diagram`

| Field | Value |
|---|---|
| Name | `render_diagram` |
| Description | Renders Mermaid diagram syntax into SVG or PNG format |
| Input Schema | `{ "mermaidSyntax": string (required), "outputFormat": enum ["svg", "png"] (default "svg"), "theme": enum ["default", "dark", "forest", "neutral"] (default "dark"), "backgroundColor": string (default "transparent"), "width": number (optional), "height": number (optional) }` |
| Output | `{ "success": boolean, "format": string, "data": string (base64-encoded for PNG, raw SVG string for SVG), "filename": string }` |

Implementation:
1. Write `mermaidSyntax` to a temporary `.mmd` file in `os.tmpdir()`.
2. Invoke `mmdc` (mermaid-cli) as a child process: `mmdc -i input.mmd -o output.svg -t dark -b transparent`.
3. Read the output file, encode as needed, return via MCP tool response.
4. Clean up temp files in a `finally` block.
5. On rendering failure, return `{ "success": false, "error": "<mmdc stderr>" }`.

##### Tool: `validate_syntax`

| Field | Value |
|---|---|
| Name | `validate_syntax` |
| Description | Validates Mermaid syntax without rendering |
| Input Schema | `{ "mermaidSyntax": string (required) }` |
| Output | `{ "valid": boolean, "errors": string[] }` |

Implementation:
- Attempt a dry-run render with mmdc to a temp SVG. If exit code is 0, valid. Otherwise parse stderr for error details.

##### Tool: `list_diagram_types`

| Field | Value |
|---|---|
| Name | `list_diagram_types` |
| Description | Lists all supported Mermaid diagram types with descriptions |
| Input Schema | `{}` (no inputs) |
| Output | Array of `{ "type": string, "description": string, "keywords": string[] }` |

Hardcode the following types: `flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram-v2`, `erDiagram`, `gantt`, `pie`, `gitGraph`, `mindmap`, `timeline`, `quadrantChart`, `sankey-beta`, `xychart-beta`, `block-beta`, `architecture-beta`.

##### Tool: `get_diagram_template`

| Field | Value |
|---|---|
| Name | `get_diagram_template` |
| Description | Returns a starter Mermaid template for the requested diagram type |
| Input Schema | `{ "diagramType": string (required) }` |
| Output | `{ "type": string, "template": string, "description": string }` |

Maintain a `templates/` directory with `.mmd` files for each type. Read and return the matching file.

#### 1.3 MCP Resources

Register a resource template: `mermaid://templates/{type}` that returns the same data as `get_diagram_template` but via the MCP resource protocol. This allows the LLM to `read` templates as context.

#### 1.4 Server Startup

```javascript
// src/mcp-server/server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "mermaid-diagram-server",
  version: "1.0.0"
});

// ... register tools and resources ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### 2. MCP Client & LLM Orchestrator (`src/mcp-client/`)

#### 2.1 MCP Client Initialization

- File: `src/mcp-client/client.js`
- Use `@modelcontextprotocol/sdk/client` with `StdioClientTransport`.
- Spawn the MCP server as a child process: `node src/mcp-server/server.js`.
- On startup, call `client.listTools()` to discover available tools and cache their schemas.

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["src/mcp-server/server.js"]
});

const client = new Client({ name: "llm-orchestrator", version: "1.0.0" });
await client.connect(transport);
const { tools } = await client.listTools();
```

#### 2.2 Tool Execution Wrapper

Export a function `callMcpTool(toolName, args)` that:
1. Calls `client.callTool({ name: toolName, arguments: args })`.
2. Parses the response content blocks.
3. Returns the parsed result.
4. Handles errors gracefully, returning a structured error object.

#### 2.3 DeepSeek LLM Integration

- File: `src/llm/deepseek.js`
- Use `fetch` (Node.js 20 built-in) to call the DeepSeek API.
- Endpoint: `https://api.deepseek.com/v1/chat/completions` (or user-configured base URL via `DEEPSEEK_BASE_URL` env var for compatible providers).
- Model: `deepseek-chat` (configurable via `DEEPSEEK_MODEL` env var).
- API key: `DEEPSEEK_API_KEY` env var.
- Enable streaming: `stream: true` for SSE delivery to frontend.

##### Tool-Use Loop (Agentic Flow)

The LLM orchestrator implements a tool-use loop:

```
1. Build messages array: system prompt + conversation history + user message
2. Send to DeepSeek with `tools` array derived from MCP tool schemas
3. If response contains tool_calls:
   a. For each tool_call, execute via MCP client
   b. Append tool results to messages as role: "tool" messages
   c. Go to step 2 (re-send with tool results)
4. If response is a plain assistant message:
   a. Stream tokens to frontend via SSE
   b. If the message contains mermaid code blocks (```mermaid), auto-invoke render_diagram
   c. Return final response + any rendered diagrams
```

##### DeepSeek Tool Format

Convert MCP tool schemas to DeepSeek function-calling format:

```javascript
function mcpToolsToDeepSeekFunctions(mcpTools) {
  return mcpTools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}
```

##### System Prompt

Use the following system prompt for the DeepSeek LLM:

```
You are a diagram generation assistant powered by Mermaid.js via MCP tools.

Your capabilities:
- Generate Mermaid diagrams from natural language descriptions
- Analyze source code (C#, C++, Python, JavaScript, TypeScript) and produce structural diagrams
- Validate and fix Mermaid syntax
- Provide diagram templates as starting points

Available diagram types: flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram, gantt, pie, gitGraph, mindmap, timeline, quadrantChart, sankey-beta, xychart-beta, block-beta, architecture-beta.

When the user asks for a diagram:
1. Determine the best diagram type for their request
2. Generate the Mermaid syntax
3. Use the render_diagram tool to produce the visual output
4. Present the rendered diagram along with the raw syntax

When source code context is provided:
- Analyze the code structure (classes, functions, inheritance, imports, dependencies)
- Choose the most appropriate diagram type (classDiagram for OOP, flowchart for control flow, sequenceDiagram for interactions, erDiagram for data models)
- Generate accurate Mermaid syntax reflecting the actual code structure
- Always use render_diagram to produce the final visual

Always validate your Mermaid syntax with validate_syntax before rendering.
Always use the "dark" theme for rendering unless the user specifies otherwise.
```

---

### 3. Source Code Parser (`src/parser/`)

#### 3.1 Parser Architecture

- File: `src/parser/index.js` — Main entry, language router.
- File: `src/parser/languages/csharp.js`
- File: `src/parser/languages/cpp.js`
- File: `src/parser/languages/python.js`
- File: `src/parser/languages/javascript.js`
- File: `src/parser/languages/typescript.js`
- File: `src/parser/common.js` — Shared utilities (file walking, output formatting).

#### 3.2 File Discovery

Given a root directory path from the user:

1. Recursively walk the directory using `fs/promises.readdir` with `{ recursive: true }`.
2. Filter files by extension mapping:
   - `.cs` → C#
   - `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`, `.hxx` → C++
   - `.py` → Python
   - `.js`, `.mjs`, `.cjs` → JavaScript
   - `.ts`, `.tsx` → TypeScript
3. Exclude common non-source directories: `node_modules`, `bin`, `obj`, `.git`, `__pycache__`, `dist`, `build`, `.vs`, `.vscode`, `.idea`.
4. Return a manifest: `{ language: string, files: { path: string, relativePath: string, sizeBytes: number }[] }[]`.

#### 3.3 Extraction Strategy

Use a **two-tier** approach:

**Tier 1 — Tree-sitter (preferred):**
- Use `tree-sitter` with language-specific grammars.
- Parse each file into an AST.
- Walk the AST to extract:
  - **Classes/Structs/Interfaces**: name, base classes, implemented interfaces, access modifiers.
  - **Methods/Functions**: name, parameters (name + type if available), return type, containing class.
  - **Properties/Fields**: name, type, access modifier.
  - **Imports/Using/Include**: module or file references.
  - **Inheritance relationships**: extends, implements, includes.
  - **Namespaces/Modules**: grouping containers.

**Tier 2 — Regex Fallback:**
- If Tree-sitter grammars fail to install (native compilation issues), fall back to regex-based extraction.
- Each language module exports both `parseWithTreeSitter(filePath)` and `parseWithRegex(filePath)`.
- The main parser tries Tree-sitter first, catches errors, falls back to regex.

#### 3.4 Language-Specific Extraction Details

##### C# (`csharp.js`)

Extract from AST or regex:
- `namespace X { }` → namespace grouping
- `class X : Y, IZ { }` → class with inheritance
- `interface IX { }` → interface
- `public void Method(int a, string b)` → method signature
- `using X;` → dependency
- `enum X { }` → enumeration

Regex patterns (fallback):
```javascript
const patterns = {
  namespace: /namespace\s+([\w.]+)/g,
  class: /(?:public|private|internal|protected|abstract|sealed|static)?\s*class\s+(\w+)(?:\s*:\s*([\w\s,.<>]+))?/g,
  interface: /(?:public|internal)?\s*interface\s+(\w+)(?:\s*:\s*([\w\s,.<>]+))?/g,
  method: /(?:public|private|protected|internal|static|virtual|override|abstract|async)[\s\w<>\[\]?]*\s+(\w+)\s*\(([^)]*)\)/g,
  property: /(?:public|private|protected|internal|static)[\s\w<>\[\]?]*\s+(\w+)\s*\{\s*get/g,
  using: /using\s+([\w.]+);/g,
  enum: /enum\s+(\w+)/g
};
```

##### C++ (`cpp.js`)

Extract:
- `class X : public Y { }` → class with inheritance
- `struct X { }` → struct
- `void func(int a)` → function
- `#include <header>` / `#include "header.h"` → dependency
- `namespace X { }` → namespace
- `template<typename T>` → note template usage

##### Python (`python.js`)

Extract:
- `class X(Y, Z):` → class with inheritance
- `def func(a, b: int) -> str:` → function with type hints
- `import X` / `from X import Y` → dependency
- `@decorator` → decorators (note but don't diagram)

##### JavaScript (`javascript.js`)

Extract:
- `class X extends Y { }` → class
- `function X() {}` / `const X = () => {}` / `const X = function() {}` → functions
- `import X from 'Y'` / `require('Y')` → dependency
- `export default` / `export { }` / `module.exports` → exports

##### TypeScript (`typescript.js`)

Extract everything from JavaScript plus:
- `interface X extends Y { }` → interface
- `type X = { }` → type alias
- `enum X { }` → enum
- Type annotations on parameters and return types

#### 3.5 Output Schema

Each parser returns a unified `CodebaseStructure` object:

```javascript
{
  rootPath: "/absolute/path/to/project",
  languages: ["csharp", "typescript"],
  files: [
    {
      path: "src/Models/User.cs",
      language: "csharp",
      namespace: "MyApp.Models",
      classes: [
        {
          name: "User",
          baseClasses: ["BaseEntity"],
          interfaces: ["IUser"],
          accessModifier: "public",
          methods: [
            {
              name: "GetFullName",
              returnType: "string",
              parameters: [],
              accessModifier: "public"
            }
          ],
          properties: [
            { name: "Email", type: "string", accessModifier: "public" }
          ]
        }
      ],
      functions: [],
      imports: ["System", "MyApp.Core"],
      enums: []
    }
  ],
  // Pre-computed relationship summaries for the LLM:
  relationships: {
    inheritance: [
      { from: "User", to: "BaseEntity", type: "extends" },
      { from: "User", to: "IUser", type: "implements" }
    ],
    dependencies: [
      { from: "User.cs", to: "System", type: "import" },
      { from: "User.cs", to: "MyApp.Core", type: "import" }
    ]
  }
}
```

#### 3.6 Context Preparation for LLM

- File: `src/parser/context-builder.js`
- Takes a `CodebaseStructure` and produces a condensed text summary suitable for the LLM context window.
- Truncation strategy: If the total summary exceeds 12,000 tokens (estimated at 4 chars/token), summarize further by omitting method bodies, collapsing parameter lists, and grouping files by namespace/module.
- Output format:

```
## Codebase Analysis: /path/to/project
Languages detected: C#, TypeScript

### C# Files (3 files)
Namespace: MyApp.Models
  Class User (extends BaseEntity, implements IUser)
    Properties: Email (string), Name (string), Id (int)
    Methods: GetFullName() -> string, Validate() -> bool

Namespace: MyApp.Services
  Class UserService (extends BaseService)
    Methods: CreateUser(User) -> Task<User>, DeleteUser(int) -> Task

### Relationships
  User ──extends──▶ BaseEntity
  User ──implements──▶ IUser
  UserService ──depends on──▶ User
```

---

### 4. Express.js Backend (`src/server/`)

#### 4.1 Server Entry Point

- File: `src/server/index.js`
- Initialize Express app on port `PORT` env var (default `3000`).
- On startup:
  1. Initialize the MCP client (spawn MCP server, connect, discover tools).
  2. Initialize the source code parser module.
  3. Serve static frontend files from `public/`.
  4. Register API routes.

#### 4.2 API Routes

##### `POST /api/chat`

Request body:
```json
{
  "message": "Create a class diagram for my project",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "codeContext": null | {
    "rootPath": "/path/to/project",
    "selectedFiles": ["src/User.cs", "src/UserService.cs"]
  }
}
```

Response: SSE stream.

Implementation:
1. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
2. If `codeContext` is provided, run the source code parser on the selected files, build the context summary, prepend it to the user message.
3. Enter the DeepSeek tool-use loop (Section 2.3).
4. Stream events to the client:
   - `event: token\ndata: {"content": "partial text"}\n\n` — streamed LLM tokens.
   - `event: tool_call\ndata: {"tool": "render_diagram", "args": {...}}\n\n` — tool invocation notification.
   - `event: tool_result\ndata: {"tool": "render_diagram", "result": {...}}\n\n` — tool result.
   - `event: diagram\ndata: {"svg": "<svg>...</svg>", "syntax": "graph TD; ..."}\n\n` — rendered diagram.
   - `event: done\ndata: {}\n\n` — stream complete.
   - `event: error\ndata: {"message": "..."}\n\n` — error notification.

##### `GET /api/browse`

Query params: `path` (directory path, default `/`).

Response:
```json
{
  "currentPath": "/home/user/projects",
  "parent": "/home/user",
  "entries": [
    { "name": "src", "type": "directory", "path": "/home/user/projects/src" },
    { "name": "README.md", "type": "file", "path": "/home/user/projects/README.md", "size": 2048, "language": null },
    { "name": "Program.cs", "type": "file", "path": "/home/user/projects/Program.cs", "size": 4096, "language": "csharp" }
  ]
}
```

Security constraints:
- Resolve the path and reject traversal attempts (`..`).
- Configurable allowed root directories via `ALLOWED_ROOTS` env var (comma-separated). Default: user home directory.
- Never expose system directories (`/etc`, `/usr`, `/var`, etc.).

##### `GET /api/file`

Query params: `path` (file path).

Response:
```json
{
  "path": "/home/user/projects/src/Program.cs",
  "language": "csharp",
  "content": "using System;\n...",
  "lines": 42,
  "sizeBytes": 1536
}
```

Security: Same constraints as `/api/browse`. Additionally, reject files larger than 1 MB.

##### `POST /api/parse`

Request body:
```json
{
  "rootPath": "/home/user/projects",
  "selectedFiles": ["src/Program.cs", "src/Utils.cs"],
  "selectedLanguages": ["csharp", "cpp"]
}
```

Response: The `CodebaseStructure` object (Section 3.5).

If `selectedFiles` is empty or null, parse all recognized source files under `rootPath`.
If `selectedLanguages` is provided, only parse files of those languages.

##### `GET /api/diagram-types`

Calls the MCP `list_diagram_types` tool and returns the result. Cached after first call.

##### `POST /api/render`

Direct rendering endpoint (bypass LLM). Request body:
```json
{
  "mermaidSyntax": "graph TD; A-->B;",
  "outputFormat": "svg",
  "theme": "dark"
}
```

Calls MCP `render_diagram` and returns the result.

---

### 5. Frontend (`public/`)

#### 5.1 File Structure

```
public/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js          — Main application controller
│   ├── chat.js         — Chat panel logic + SSE handling
│   ├── browser.js      — Directory browser logic
│   ├── diagram.js      — Diagram display + interaction
│   └── utils.js        — Shared utilities
└── assets/
    └── icons/          — SVG icons for file types
```

#### 5.2 Layout

Two-panel responsive layout:

- **Left Panel (60% width)**: Chat interface.
- **Right Panel (40% width)**: Tabbed panel with tabs for "Directory Browser" and "Code Preview".
- **Bottom Drawer (collapsible)**: Diagram gallery showing all diagrams generated in the current session.

On mobile (< 768px), panels stack vertically with a tab switcher.

#### 5.3 Color Scheme (Dark Theme)

```css
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border-color: #30363d;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --accent-primary: #58a6ff;
  --accent-secondary: #3fb950;
  --accent-warning: #d29922;
  --accent-error: #f85149;
  --code-bg: #1a1f26;
  --scrollbar-thumb: #484f58;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

#### 5.4 Chat Panel (`chat.js`)

Components:
- **Message List**: Scrollable container rendering chat messages. Each message has:
  - Avatar (user icon or bot icon).
  - Sender label ("You" or "Assistant").
  - Content area — rendered Markdown for assistant messages, plain text for user messages.
  - Inline diagram display — when the SSE stream delivers a `diagram` event, render the SVG inline within the message.
  - Tool call indicators — when `tool_call` events arrive, show a subtle "Calling render_diagram..." status badge.
  - Timestamp.

- **Input Area**: Multi-line textarea with:
  - Shift+Enter for newlines, Enter to send.
  - "Attach Code Context" button that opens the directory browser in the right panel and lets the user select files. Selected files appear as pills/tags below the input.
  - Send button.
  - Loading spinner during LLM processing.

- **SSE Handling**:
  ```javascript
  function sendMessage(message, codeContext) {
    const eventSource = new EventSource('/api/chat?' + new URLSearchParams({
      // ... not ideal for POST, see implementation note below
    }));
    // NOTE: Since EventSource only supports GET, use fetch() with
    // ReadableStream for POST requests instead:
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationHistory, codeContext })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Parse SSE events from buffer
      const events = parseSSEEvents(buffer);
      for (const event of events) {
        handleEvent(event);
      }
    }
  }
  ```

- **Markdown Rendering**: Use a lightweight Markdown-to-HTML converter (either a small bundled lib or simple regex replacement for bold, italic, code blocks, lists, headings). Mermaid code blocks (` ```mermaid `) should be rendered as syntax-highlighted text with a "Copy Syntax" button.

#### 5.5 Directory Browser (`browser.js`)

Components:
- **Path Bar**: Shows the current directory path with clickable breadcrumbs. Includes a text input for manually typing a path and a "Go" button.
- **File Tree**: Lists entries from `/api/browse`. Directories are clickable (navigate into). Files show language-specific icons and are selectable via checkboxes.
- **Language Filter**: Checkbox group to filter displayed files by language (C#, C++, Python, JavaScript, TypeScript).
- **Selection Summary**: Footer bar showing "N files selected across M languages" with a "Parse & Attach to Chat" button.
- **File Click Preview**: Clicking a file name (not checkbox) loads its content via `/api/file` and displays it in the "Code Preview" tab with syntax highlighting (use basic keyword-based highlighting or a minimal highlight.js bundle).

Behavior:
- When "Parse & Attach to Chat" is clicked:
  1. Call `POST /api/parse` with the selected file paths.
  2. Show a loading spinner.
  3. On success, store the parsed `CodebaseStructure` in the app state.
  4. Show a confirmation banner: "Code context attached (N classes, M functions across K files)".
  5. Subsequent chat messages will include this code context until the user clears it.

#### 5.6 Diagram Display (`diagram.js`)

- Rendered SVG diagrams appear inline in chat messages.
- Each diagram has an action bar:
  - **Full Screen**: Opens the diagram in a modal/overlay for detailed viewing.
  - **Download SVG**: Triggers download of the raw SVG file.
  - **Download PNG**: Calls `/api/render` with `outputFormat: "png"` and triggers download.
  - **Copy Syntax**: Copies the Mermaid source syntax to clipboard.
  - **Edit**: Opens a Mermaid syntax editor (simple textarea) pre-populated with the diagram syntax. User can edit and re-render via `/api/render`.
- The bottom diagram gallery shows thumbnails of all session diagrams with click-to-expand.

---

### 6. Configuration

#### 6.1 Environment Variables (`.env`)

```env
# DeepSeek LLM
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Server
PORT=3000
HOST=0.0.0.0

# File System Security
ALLOWED_ROOTS=/home,/projects,/workspace
MAX_FILE_SIZE_MB=1

# Mermaid
MERMAID_THEME=dark
MERMAID_OUTPUT_DIR=./output/diagrams

# Parsing
PARSER_STRATEGY=auto        # "treesitter", "regex", or "auto" (try treesitter, fallback to regex)
MAX_PARSE_FILES=200
MAX_PARSE_DEPTH=10
```

#### 6.2 Configuration File (`config.js`)

Centralized config loader that reads `.env` via `dotenv`, validates required fields, and exports a frozen config object. Fail fast on startup if `DEEPSEEK_API_KEY` is missing.

---

### 7. Project Structure

```
llm-mermaid-mcp/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── config.js
├── src/
│   ├── mcp-server/
│   │   ├── server.js
│   │   ├── tools/
│   │   │   ├── render-diagram.js
│   │   │   ├── validate-syntax.js
│   │   │   ├── list-diagram-types.js
│   │   │   └── get-diagram-template.js
│   │   ├── resources/
│   │   │   └── templates.js
│   │   └── templates/
│   │       ├── flowchart.mmd
│   │       ├── sequenceDiagram.mmd
│   │       ├── classDiagram.mmd
│   │       ├── stateDiagram-v2.mmd
│   │       ├── erDiagram.mmd
│   │       ├── gantt.mmd
│   │       ├── pie.mmd
│   │       ├── gitGraph.mmd
│   │       ├── mindmap.mmd
│   │       └── timeline.mmd
│   ├── mcp-client/
│   │   └── client.js
│   ├── llm/
│   │   ├── deepseek.js
│   │   ├── system-prompt.js
│   │   └── tool-loop.js
│   ├── parser/
│   │   ├── index.js
│   │   ├── common.js
│   │   ├── context-builder.js
│   │   └── languages/
│   │       ├── csharp.js
│   │       ├── cpp.js
│   │       ├── python.js
│   │       ├── javascript.js
│   │       └── typescript.js
│   └── server/
│       ├── index.js
│       ├── routes/
│       │   ├── chat.js
│       │   ├── browse.js
│       │   ├── parse.js
│       │   └── diagram.js
│       └── middleware/
│           ├── security.js
│           └── error-handler.js
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── chat.js
│   │   ├── browser.js
│   │   ├── diagram.js
│   │   └── utils.js
│   └── assets/
│       └── icons/
└── output/
    └── diagrams/
```

---

### 8. Package Dependencies

```json
{
  "name": "llm-mermaid-mcp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server/index.js",
    "dev": "node --watch src/server/index.js",
    "mcp-server": "node src/mcp-server/server.js",
    "test": "node --test tests/"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "@mermaid-js/mermaid-cli": "^11.0.0",
    "express": "^4.21.0",
    "dotenv": "^16.4.0",
    "tree-sitter": "^0.22.0",
    "tree-sitter-c-sharp": "^0.23.0",
    "tree-sitter-cpp": "^0.23.0",
    "tree-sitter-python": "^0.23.0",
    "tree-sitter-javascript": "^0.23.0",
    "tree-sitter-typescript": "^0.23.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

Note: Tree-sitter packages require native compilation. If installation fails on the target platform, the parser will automatically fall back to regex mode (`PARSER_STRATEGY=auto`).

---

### 9. Error Handling & Edge Cases

1. **MCP Server Crash**: The MCP client should detect when the child process exits unexpectedly and attempt to restart it (up to 3 retries with exponential backoff: 1s, 2s, 4s). Log each restart attempt. After 3 failures, mark MCP tools as unavailable and inform the user in chat that diagram rendering is temporarily offline.

2. **DeepSeek API Errors**: Handle HTTP 429 (rate limit) with retry-after header respect. Handle 401 (invalid key) with a clear error message. Handle 500+ with generic retry (max 2). Handle network timeouts (30s default) with abort controller.

3. **Mermaid Syntax Errors**: When mmdc fails to render, return the stderr to the LLM as a tool error result so it can fix the syntax and retry. Limit auto-fix attempts to 3.

4. **Large Codebases**: If the directory scan finds more than `MAX_PARSE_FILES` source files, prompt the user to narrow the selection. If a single file exceeds `MAX_FILE_SIZE_MB`, skip it and note the skip in the parse results.

5. **Path Traversal Attacks**: The browse and file APIs must resolve paths with `path.resolve()` and verify the resolved path starts with one of the `ALLOWED_ROOTS`. Reject all other paths with 403.

6. **SSE Connection Drops**: The frontend should detect disconnection (EventSource `onerror` or ReadableStream closure) and show a reconnection prompt. Conversation state is maintained client-side.

7. **Concurrent Requests**: Use a simple request queue for MCP tool calls (the stdio transport is single-channel). Queue tool calls and process sequentially.

---

### 10. Startup Sequence

1. Load environment variables from `.env`.
2. Validate configuration (fail fast on missing `DEEPSEEK_API_KEY`).
3. Spawn MCP server child process.
4. Initialize MCP client and connect via stdio.
5. Discover MCP tools and cache schemas.
6. Test MCP connection with a simple `validate_syntax` call.
7. Start Express server.
8. Log: `Server running on http://HOST:PORT`.
9. Log: `MCP server connected, N tools available`.
10. Log: `Parser strategy: auto (treesitter available: true/false)`.

---

### 11. Usage Flow Examples

#### Flow 1: Natural Language to Diagram

```
User: "Create a sequence diagram showing a user logging in with OAuth2"
→ LLM generates Mermaid syntax for sequenceDiagram
→ LLM calls validate_syntax → valid
→ LLM calls render_diagram with dark theme
→ SVG returned, streamed to browser as inline diagram
→ User sees the rendered diagram + raw syntax in chat
```

#### Flow 2: Source Code to Diagram

```
User: Browses to /home/user/myapp/src in directory browser
User: Selects Models/User.cs, Models/Order.cs, Services/OrderService.cs
User: Clicks "Parse & Attach to Chat"
→ Backend parses 3 files, extracts classes, relationships
→ Code context badge appears in chat input
User: "Generate a class diagram for the selected code"
→ LLM receives code structure context + user request
→ LLM generates classDiagram Mermaid syntax reflecting actual classes
→ LLM calls render_diagram
→ Rendered diagram appears in chat
```

#### Flow 3: Edit and Re-render

```
User: Clicks "Edit" on a previously rendered diagram
→ Mermaid syntax editor opens with pre-populated syntax
User: Modifies a node label
User: Clicks "Re-render"
→ Frontend calls POST /api/render directly (no LLM involved)
→ Updated SVG replaces the old one
```

---

### 12. Security Considerations

- **API Key Protection**: `DEEPSEEK_API_KEY` is never sent to the frontend. All LLM calls happen server-side.
- **File System Sandboxing**: The browse/file APIs are restricted to `ALLOWED_ROOTS`. Path traversal is blocked at the middleware level.
- **Input Sanitization**: Mermaid syntax is passed through mmdc which runs in its own process. SVG output is sanitized before embedding in the page (strip `<script>` tags, event handlers, external resource references).
- **Rate Limiting**: Apply basic rate limiting on `/api/chat` (e.g., 20 requests/minute per IP) using a simple in-memory counter. No external dependency needed.
- **CORS**: Restrict to same-origin in production. Allow `localhost` origins in development.

---

### 13. Testing Outline

- **MCP Server Unit Tests**: Test each tool in isolation — provide known Mermaid syntax, verify SVG output; provide invalid syntax, verify error response.
- **Parser Unit Tests**: For each language, provide sample source files and verify the extracted `CodebaseStructure` matches expected output. Test both Tree-sitter and regex paths.
- **API Integration Tests**: Test each Express route with valid and invalid inputs. Test SSE streaming with a mock DeepSeek response.
- **Security Tests**: Verify path traversal rejection. Verify large file rejection. Verify rate limiting.
- **End-to-End Test**: Script a full flow — send a chat message requesting a diagram, verify the SSE stream contains `token`, `tool_call`, `tool_result`, and `diagram` events in order.
