import express from 'express';
import config from '../../config.js';
import { initMcpClient, isMcpAvailable, callMcpTool } from '../mcp-client/client.js';
import chatRouter from './routes/chat.js';
import browseRouter from './routes/browse.js';
import parseRouter from './routes/parse.js';
import diagramRouter from './routes/diagram.js';
import fileRouter from './routes/file.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(config.paths.public));

// CORS for development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/browse', browseRouter);
app.use('/api/parse', parseRouter);
app.use('/api/diagram', diagramRouter);
app.use('/api/file', fileRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mcpAvailable: isMcpAvailable(),
  });
});

// Error handler
app.use(errorHandler);

// Startup sequence
async function start() {
  console.log('Starting LLM Mermaid MCP application...');

  // Step 1: Config loaded (already done by import)
  console.log('[Config] Configuration loaded');

  // Step 2-5: Initialize MCP
  try {
    const { tools } = await initMcpClient();
    console.log(`[MCP] Server connected, ${tools.length} tools available`);

    // Step 6: Test MCP connection
    const testResult = await callMcpTool('validate_syntax', { mermaidSyntax: 'graph TD; A-->B;' });
    if (testResult.valid !== undefined) {
      console.log('[MCP] Connection test passed');
    } else {
      console.warn('[MCP] Connection test returned unexpected result:', testResult);
    }
  } catch (err) {
    console.error('[MCP] Failed to initialize MCP client:', err.message);
    console.warn('[MCP] Server will start without MCP tools. Diagram rendering unavailable.');
  }

  // Step 7-10: Start Express
  app.listen(config.server.port, config.server.host, () => {
    console.log(`[Server] Running on http://${config.server.host}:${config.server.port}`);
    console.log(`[Parser] Strategy: ${config.parser.strategy} (regex fallback active)`);
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
