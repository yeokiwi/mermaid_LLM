import fs from 'fs/promises';
import { createEmptyFileStructure } from '../common.js';

const patterns = {
  class: /class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g,
  function: /function\s+(\w+)\s*\(([^)]*)\)/g,
  arrowConst: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
  funcExprConst: /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
  importFrom: /import\s+(?:(?:\{[^}]*\}|\w+)(?:\s*,\s*(?:\{[^}]*\}|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g,
  require: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  exportDefault: /export\s+default\s+(?:class|function)?\s*(\w+)?/g,
  exportNamed: /export\s+(?:const|let|var|function|class)\s+(\w+)/g,
  moduleExports: /module\.exports\s*=\s*(\w+)/g,
};

export async function parseWithRegex(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const structure = createEmptyFileStructure(filePath, 'javascript');

  let match;

  // Extract imports
  while ((match = patterns.importFrom.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.importFrom.lastIndex = 0;

  while ((match = patterns.require.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.require.lastIndex = 0;

  // Extract classes
  while ((match = patterns.class.exec(content)) !== null) {
    structure.classes.push({
      name: match[1],
      kind: 'class',
      baseClasses: match[2] ? [match[2]] : [],
      interfaces: [],
      accessModifier: 'public',
      methods: [],
      properties: [],
    });
  }
  patterns.class.lastIndex = 0;

  // Extract functions
  while ((match = patterns.function.exec(content)) !== null) {
    structure.functions.push({
      name: match[1],
      returnType: 'any',
      parameters: parseParameters(match[2]),
    });
  }
  patterns.function.lastIndex = 0;

  // Arrow functions
  while ((match = patterns.arrowConst.exec(content)) !== null) {
    structure.functions.push({
      name: match[1],
      returnType: 'any',
      parameters: parseParameters(match[2]),
    });
  }
  patterns.arrowConst.lastIndex = 0;

  // Function expressions
  while ((match = patterns.funcExprConst.exec(content)) !== null) {
    structure.functions.push({
      name: match[1],
      returnType: 'any',
      parameters: parseParameters(match[2]),
    });
  }
  patterns.funcExprConst.lastIndex = 0;

  return structure;
}

function parseParameters(paramStr) {
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map(p => {
    const name = p.trim().replace(/=.*$/, '').trim();
    if (!name) return null;
    return { name, type: 'any' };
  }).filter(Boolean);
}

export const parseWithTreeSitter = null;
