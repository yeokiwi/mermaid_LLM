import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { validatePath } from '../middleware/security.js';
import { getLanguageForFile } from '../../parser/common.js';
import config from '../../../config.js';

const router = Router();

router.get('/', async (req, res) => {
  const requestedPath = req.query.path || os.homedir();
  const validation = validatePath(requestedPath);

  if (!validation.valid) {
    return res.status(403).json({ error: validation.error });
  }

  try {
    const entries = await fs.readdir(validation.resolved, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      // Skip hidden directories and common non-source dirs
      if (entry.name.startsWith('.') && entry.isDirectory()) continue;

      const entryPath = path.join(validation.resolved, entry.name);

      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          type: 'directory',
          path: entryPath,
        });
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(entryPath);
          result.push({
            name: entry.name,
            type: 'file',
            path: entryPath,
            size: stat.size,
            language: getLanguageForFile(entry.name),
          });
        } catch {
          // skip unreadable files
        }
      }
    }

    // Sort: directories first, then files, alphabetically
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parentPath = path.dirname(validation.resolved);
    const parentValidation = validatePath(parentPath);

    res.json({
      currentPath: validation.resolved,
      parent: parentValidation.valid ? parentPath : null,
      entries: result,
    });
  } catch (err) {
    res.status(500).json({ error: `Failed to read directory: ${err.message}` });
  }
});

export default router;
