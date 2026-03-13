import fs from 'fs/promises';
import path from 'path';
import config from '../../config.js';

const EXTENSION_MAP = {
  '.cs': 'csharp',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.h': 'cpp', '.hpp': 'cpp', '.hxx': 'cpp',
  '.py': 'python',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
};

const EXCLUDED_DIRS = new Set([
  'node_modules', 'bin', 'obj', '.git', '__pycache__',
  'dist', 'build', '.vs', '.vscode', '.idea',
]);

export function getLanguageForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] || null;
}

export async function discoverFiles(rootPath, selectedLanguages = null, maxDepth = config.parser.maxDepth) {
  const results = [];

  async function walk(dir, depth) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await walk(fullPath, depth + 1);
        }
        continue;
      }

      if (entry.isFile()) {
        const language = getLanguageForFile(entry.name);
        if (language && (!selectedLanguages || selectedLanguages.includes(language))) {
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size <= config.security.maxFileSizeMB * 1024 * 1024) {
              results.push({
                path: fullPath,
                relativePath: path.relative(rootPath, fullPath),
                sizeBytes: stat.size,
                language,
              });
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  await walk(rootPath, 0);
  return results;
}

export function groupFilesByLanguage(files) {
  const groups = {};
  for (const file of files) {
    if (!groups[file.language]) {
      groups[file.language] = [];
    }
    groups[file.language].push(file);
  }
  return Object.entries(groups).map(([language, files]) => ({ language, files }));
}

export function createEmptyFileStructure(filePath, language) {
  return {
    path: filePath,
    language,
    namespace: null,
    classes: [],
    functions: [],
    imports: [],
    enums: [],
  };
}
