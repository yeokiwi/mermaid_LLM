import { Router } from 'express';
import fs from 'fs/promises';
import { validatePath } from '../middleware/security.js';
import { getLanguageForFile } from '../../parser/common.js';
import config from '../../../config.js';

const router = Router();

router.get('/', async (req, res) => {
  const requestedPath = req.query.path;

  if (!requestedPath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  const validation = validatePath(requestedPath);
  if (!validation.valid) {
    return res.status(403).json({ error: validation.error });
  }

  try {
    const stat = await fs.stat(validation.resolved);

    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }

    if (stat.size > config.security.maxFileSizeMB * 1024 * 1024) {
      return res.status(413).json({ error: `File exceeds maximum size of ${config.security.maxFileSizeMB}MB` });
    }

    const content = await fs.readFile(validation.resolved, 'utf-8');
    const lines = content.split('\n').length;

    res.json({
      path: validation.resolved,
      language: getLanguageForFile(validation.resolved),
      content,
      lines,
      sizeBytes: stat.size,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: `Failed to read file: ${err.message}` });
  }
});

export default router;
