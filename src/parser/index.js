import { discoverFiles, groupFilesByLanguage, getLanguageForFile } from './common.js';
import { parseWithRegex as parseCSharp } from './languages/csharp.js';
import { parseWithRegex as parseCpp } from './languages/cpp.js';
import { parseWithRegex as parsePython } from './languages/python.js';
import { parseWithRegex as parseJavaScript } from './languages/javascript.js';
import { parseWithRegex as parseTypeScript } from './languages/typescript.js';
import config from '../../config.js';
import path from 'path';

const PARSERS = {
  csharp: parseCSharp,
  cpp: parseCpp,
  python: parsePython,
  javascript: parseJavaScript,
  typescript: parseTypeScript,
};

export async function parseCodebase(rootPath, selectedFiles = null, selectedLanguages = null) {
  let files;

  if (selectedFiles && selectedFiles.length > 0) {
    files = selectedFiles.map(f => {
      const fullPath = path.isAbsolute(f) ? f : path.join(rootPath, f);
      const language = getLanguageForFile(fullPath);
      return { path: fullPath, relativePath: path.relative(rootPath, fullPath), language, sizeBytes: 0 };
    }).filter(f => f.language);
  } else {
    files = await discoverFiles(rootPath, selectedLanguages);
  }

  if (files.length > config.parser.maxFiles) {
    return {
      error: `Too many files (${files.length}). Maximum is ${config.parser.maxFiles}. Please narrow your selection.`,
      fileCount: files.length,
      maxFiles: config.parser.maxFiles,
    };
  }

  const parsedFiles = [];
  const allRelationships = { inheritance: [], dependencies: [] };
  const languagesUsed = new Set();

  for (const file of files) {
    const parser = PARSERS[file.language];
    if (!parser) continue;

    try {
      const parsed = await parser(file.path);
      parsed.path = file.relativePath;
      parsedFiles.push(parsed);
      languagesUsed.add(file.language);

      // Extract relationships
      for (const cls of parsed.classes) {
        for (const base of cls.baseClasses) {
          allRelationships.inheritance.push({
            from: cls.name,
            to: base,
            type: 'extends',
          });
        }
        for (const iface of (cls.interfaces || [])) {
          allRelationships.inheritance.push({
            from: cls.name,
            to: iface,
            type: cls.kind === 'interface' ? 'extends' : 'implements',
          });
        }
      }

      for (const imp of parsed.imports) {
        allRelationships.dependencies.push({
          from: file.relativePath,
          to: imp,
          type: 'import',
        });
      }
    } catch (err) {
      console.error(`[Parser] Failed to parse ${file.path}:`, err.message);
    }
  }

  return {
    rootPath,
    languages: [...languagesUsed],
    files: parsedFiles,
    relationships: allRelationships,
  };
}
