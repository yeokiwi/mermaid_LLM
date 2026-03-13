import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import config from "../../config.js";

let client = null;
let transport = null;
let cachedTools = [];
let restartCount = 0;
const MAX_RESTARTS = 3;

export async function initMcpClient() {
  transport = new StdioClientTransport({
    command: "node",
    args: [config.paths.mcpServer],
  });

  client = new Client({ name: "llm-orchestrator", version: "1.0.0" });

  transport.onerror = (err) => {
    console.error("[MCP Client] Transport error:", err.message);
  };

  transport.onclose = async () => {
    console.warn("[MCP Client] Transport closed unexpectedly");
    if (restartCount < MAX_RESTARTS) {
      restartCount++;
      const delay = Math.pow(2, restartCount - 1) * 1000;
      console.log(`[MCP Client] Attempting restart ${restartCount}/${MAX_RESTARTS} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      try {
        await initMcpClient();
        console.log("[MCP Client] Reconnected successfully");
      } catch (err) {
        console.error("[MCP Client] Restart failed:", err.message);
      }
    } else {
      console.error("[MCP Client] Max restarts reached. MCP tools unavailable.");
    }
  };

  await client.connect(transport);

  const { tools } = await client.listTools();
  cachedTools = tools;
  restartCount = 0;

  console.log(`[MCP Client] Connected, ${tools.length} tools available`);
  return { client, tools: cachedTools };
}

export async function callMcpTool(toolName, args) {
  if (!client) {
    return { error: "MCP client not initialized" };
  }

  try {
    const result = await client.callTool({ name: toolName, arguments: args });

    if (result.content && result.content.length > 0) {
      const textContent = result.content.find(c => c.type === "text");
      if (textContent) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return { data: textContent.text };
        }
      }
    }

    return result;
  } catch (err) {
    console.error(`[MCP Client] Tool call failed (${toolName}):`, err.message);
    return { error: err.message };
  }
}

export function getMcpTools() {
  return cachedTools;
}

export function isMcpAvailable() {
  return client !== null && cachedTools.length > 0;
}

export async function closeMcpClient() {
  if (transport) {
    await transport.close();
    transport = null;
    client = null;
    cachedTools = [];
  }
}
