import path from 'path';
import config from '../../../config.js';

const BLOCKED_ROOTS = ['/etc', '/usr', '/var', '/sys', '/proc', '/dev', '/boot', '/sbin', '/bin'];

export function validatePath(requestedPath) {
  const resolved = path.resolve(requestedPath);

  // Block system directories
  for (const blocked of BLOCKED_ROOTS) {
    if (resolved === blocked || resolved.startsWith(blocked + '/')) {
      return { valid: false, error: 'Access denied: system directory', resolved };
    }
  }

  // Check against allowed roots
  const allowed = config.security.allowedRoots.some(root => {
    const resolvedRoot = path.resolve(root);
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + '/');
  });

  if (!allowed) {
    return { valid: false, error: 'Access denied: path outside allowed roots', resolved };
  }

  // Block path traversal
  if (requestedPath.includes('..')) {
    return { valid: false, error: 'Access denied: path traversal detected', resolved };
  }

  return { valid: true, resolved };
}

export function pathSecurityMiddleware(req, res, next) {
  const requestedPath = req.query.path || req.body?.rootPath;
  if (requestedPath) {
    const validation = validatePath(requestedPath);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }
    req.resolvedPath = validation.resolved;
  }
  next();
}

// Simple in-memory rate limiter
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20;

export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return next();
  }

  const entry = rateLimitStore.get(ip);

  if (now - entry.windowStart > RATE_LIMIT_WINDOW) {
    entry.count = 1;
    entry.windowStart = now;
    return next();
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait before making more requests.' });
  }

  next();
}

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);
