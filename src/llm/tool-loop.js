import { callDeepSeek, mcpToolsToDeepSeekFunctions, streamDeepSeek } from './deepseek.js';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { callMcpTool, getMcpTools } from '../mcp-client/client.js';

const MAX_TOOL_ITERATIONS = 10;
const MAX_SYNTAX_FIX_ATTEMPTS = 3;

export async function runToolLoop(userMessage, conversationHistory = [], codeContext = null, sseWriter) {
  const deepSeekTools = mcpToolsToDeepSeekFunctions(getMcpTools());

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
  ];

  if (codeContext) {
    messages.push({
      role: "user",
      content: `[Source Code Context]\n${codeContext}\n\n${userMessage}`,
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    const response = await callDeepSeek(messages, deepSeekTools);

    if (!response.choices || response.choices.length === 0) {
      sseWriter.writeEvent('error', { message: 'No response from LLM' });
      break;
    }

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    messages.push(assistantMessage);

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs;

        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = {};
        }

        sseWriter.writeEvent('tool_call', { tool: toolName, args: toolArgs });

        const toolResult = await callMcpTool(toolName, toolArgs);

        sseWriter.writeEvent('tool_result', { tool: toolName, result: toolResult });

        if (toolName === 'render_diagram' && toolResult.success && toolResult.format === 'svg') {
          sseWriter.writeEvent('diagram', {
            svg: toolResult.data,
            syntax: toolArgs.mermaidSyntax,
            filename: toolResult.filename,
          });
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      continue;
    }

    // No tool calls — stream the final text response
    const content = assistantMessage.content || '';
    sseWriter.writeEvent('token', { content });

    // Check for mermaid code blocks in the response and auto-render
    const mermaidBlocks = extractMermaidBlocks(content);
    for (const block of mermaidBlocks) {
      sseWriter.writeEvent('tool_call', { tool: 'render_diagram', args: { mermaidSyntax: block } });
      const renderResult = await callMcpTool('render_diagram', {
        mermaidSyntax: block,
        outputFormat: 'svg',
        theme: 'dark',
        backgroundColor: 'transparent',
      });
      sseWriter.writeEvent('tool_result', { tool: 'render_diagram', result: renderResult });
      if (renderResult.success && renderResult.format === 'svg') {
        sseWriter.writeEvent('diagram', {
          svg: renderResult.data,
          syntax: block,
          filename: renderResult.filename,
        });
      }
    }

    break;
  }

  sseWriter.writeEvent('done', {});
  return messages;
}

function extractMermaidBlocks(text) {
  const blocks = [];
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export class SSEWriter {
  constructor(res) {
    this.res = res;
  }

  writeEvent(event, data) {
    if (!this.res.writableEnded) {
      this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  end() {
    if (!this.res.writableEnded) {
      this.res.end();
    }
  }
}
