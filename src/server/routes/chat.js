import { Router } from 'express';
import { runToolLoop, SSEWriter } from '../../llm/tool-loop.js';
import { parseCodebase } from '../../parser/index.js';
import { buildContext } from '../../parser/context-builder.js';
import { rateLimiter } from '../middleware/security.js';

const router = Router();

router.post('/', rateLimiter, async (req, res) => {
  const { message, conversationHistory = [], codeContext = null } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sseWriter = new SSEWriter(res);

  try {
    let contextText = null;

    if (codeContext && codeContext.rootPath) {
      const codebaseStructure = await parseCodebase(
        codeContext.rootPath,
        codeContext.selectedFiles,
      );
      contextText = buildContext(codebaseStructure);
    }

    await runToolLoop(message, conversationHistory, contextText, sseWriter);
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    sseWriter.writeEvent('error', { message: err.message });
    sseWriter.writeEvent('done', {});
  }

  sseWriter.end();
});

export default router;
