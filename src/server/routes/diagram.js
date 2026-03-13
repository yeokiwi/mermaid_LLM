import { Router } from 'express';
import { callMcpTool, isMcpAvailable } from '../../mcp-client/client.js';

const router = Router();

let cachedDiagramTypes = null;

router.get('/types', async (req, res) => {
  if (!isMcpAvailable()) {
    return res.status(503).json({ error: 'MCP server unavailable' });
  }

  if (cachedDiagramTypes) {
    return res.json(cachedDiagramTypes);
  }

  try {
    const result = await callMcpTool('list_diagram_types', {});
    cachedDiagramTypes = result;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/render', async (req, res) => {
  if (!isMcpAvailable()) {
    return res.status(503).json({ error: 'MCP server unavailable' });
  }

  const { mermaidSyntax, outputFormat = 'svg', theme = 'dark' } = req.body;

  if (!mermaidSyntax) {
    return res.status(400).json({ error: 'mermaidSyntax is required' });
  }

  try {
    const result = await callMcpTool('render_diagram', {
      mermaidSyntax,
      outputFormat,
      theme,
      backgroundColor: 'transparent',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
