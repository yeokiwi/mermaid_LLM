import { Router } from 'express';
import { parseCodebase } from '../../parser/index.js';
import { validatePath } from '../middleware/security.js';

const router = Router();

router.post('/', async (req, res) => {
  const { rootPath, selectedFiles = null, selectedLanguages = null } = req.body;

  if (!rootPath) {
    return res.status(400).json({ error: 'rootPath is required' });
  }

  const validation = validatePath(rootPath);
  if (!validation.valid) {
    return res.status(403).json({ error: validation.error });
  }

  try {
    const result = await parseCodebase(validation.resolved, selectedFiles, selectedLanguages);

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: `Parse failed: ${err.message}` });
  }
});

export default router;
