import config from '../../config.js';

export function mcpToolsToDeepSeekFunctions(mcpTools) {
  return mcpTools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

export async function callDeepSeek(messages, tools = [], { stream = false } = {}) {
  const url = `${config.deepseek.baseUrl}/chat/completions`;

  const body = {
    model: config.deepseek.model,
    messages,
    stream,
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseek.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new Error(`Rate limited. Retry after ${retryAfter || 'unknown'} seconds`);
      }
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your DEEPSEEK_API_KEY.');
      }
      throw new Error(`DeepSeek API error ${response.status}: ${errorBody}`);
    }

    if (stream) {
      return response;
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('DeepSeek API request timed out (30s)');
    }
    throw err;
  }
}

export async function streamDeepSeek(messages, tools = []) {
  return callDeepSeek(messages, tools, { stream: true });
}
