import fs from 'fs/promises';
import { createEmptyFileStructure } from '../common.js';

const patterns = {
  class: /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*\{/g,
  interface: /interface\s+(\w+)(?:\s+extends\s+([\w\s,]+))?\s*\{/g,
  typeAlias: /type\s+(\w+)\s*=\s*/g,
  enum: /enum\s+(\w+)\s*\{/g,
  function: /function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([\w<>\[\]|&\s]+))?/g,
  arrowConst: /(?:const|let|var)\s+(\w+)\s*(?::\s*[\w<>\[\]|&()\s=>]+)?\s*=\s*(?:async\s+)?(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([\w<>\[\]|&\s]+))?\s*=>/g,
  importFrom: /import\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g,
  exportDefault: /export\s+default\s+(?:class|function|interface)?\s*(\w+)?/g,
  exportNamed: /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g,
};

export async function parseWithRegex(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const structure = createEmptyFileStructure(filePath, 'typescript');

  let match;

  // Extract imports
  while ((match = patterns.importFrom.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.importFrom.lastIndex = 0;

  // Extract interfaces
  while ((match = patterns.interface.exec(content)) !== null) {
    const name = match[1];
    const bases = match[2] ? match[2].split(',').map(b => b.trim()).filter(Boolean) : [];
    structure.classes.push({
      name,
      kind: 'interface',
      baseClasses: bases,
      interfaces: [],
      accessModifier: 'public',
      methods: [],
      properties: [],
    });
  }
  patterns.interface.lastIndex = 0;

  // Extract enums
  while ((match = patterns.enum.exec(content)) !== null) {
    structure.enums.push({ name: match[1] });
  }
  patterns.enum.lastIndex = 0;

  // Extract type aliases
  while ((match = patterns.typeAlias.exec(content)) !== null) {
    structure.enums.push({ name: match[1], kind: 'type' });
  }
  patterns.typeAlias.lastIndex = 0;

  // Extract classes
  while ((match = patterns.class.exec(content)) !== null) {
    const name = match[1];
    const baseClasses = match[2] ? [match[2]] : [];
    const interfaces = match[3] ? match[3].split(',').map(i => i.trim()).filter(Boolean) : [];
    structure.classes.push({
      name,
      kind: 'class',
      baseClasses,
      interfaces,
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
      returnType: match[3] ? match[3].trim() : 'any',
      parameters: parseParameters(match[2]),
    });
  }
  patterns.function.lastIndex = 0;

  // Arrow functions
  while ((match = patterns.arrowConst.exec(content)) !== null) {
    structure.functions.push({
      name: match[1],
      returnType: match[3] ? match[3].trim() : 'any',
      parameters: parseParameters(match[2]),
    });
  }
  patterns.arrowConst.lastIndex = 0;

  return structure;
}

function parseParameters(paramStr) {
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map(p => {
    const trimmed = p.trim();
    if (!trimmed) return null;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const name = trimmed.slice(0, colonIdx).trim().replace(/\?$/, '');
      const type = trimmed.slice(colonIdx + 1).trim().replace(/=.*$/, '').trim();
      return { name, type };
    }

    const name = trimmed.replace(/=.*$/, '').trim();
    return { name, type: 'any' };
  }).filter(Boolean);
}

export const parseWithTreeSitter = null;
