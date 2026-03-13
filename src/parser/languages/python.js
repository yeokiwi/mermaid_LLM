import fs from 'fs/promises';
import { createEmptyFileStructure } from '../common.js';

const patterns = {
  class: /^class\s+(\w+)(?:\(([^)]*)\))?:/gm,
  function: /^(?:    |\t)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([\w\[\],.\s|]+))?:/gm,
  import: /^import\s+([\w.]+)/gm,
  fromImport: /^from\s+([\w.]+)\s+import/gm,
  decorator: /^@(\w+)/gm,
};

export async function parseWithRegex(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const structure = createEmptyFileStructure(filePath, 'python');

  let match;

  // Extract imports
  while ((match = patterns.import.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.import.lastIndex = 0;

  while ((match = patterns.fromImport.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.fromImport.lastIndex = 0;

  // Extract classes
  const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:/gm;
  while ((match = classRegex.exec(content)) !== null) {
    const name = match[1];
    const bases = match[2] ? match[2].split(',').map(b => b.trim()).filter(b => b && b !== 'object') : [];

    structure.classes.push({
      name,
      kind: 'class',
      baseClasses: bases,
      interfaces: [],
      accessModifier: 'public',
      methods: [],
      properties: [],
    });
  }

  // Extract functions
  const funcRegex = /^( *)def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([\w\[\],.\s|]+))?:/gm;
  while ((match = funcRegex.exec(content)) !== null) {
    const indent = match[1];
    const name = match[2];
    const params = match[3];
    const returnType = match[4] ? match[4].trim() : null;

    const parsedParams = parseParameters(params);

    if (indent.length > 0 && structure.classes.length > 0) {
      // Method of the most recently defined class
      const lastClass = structure.classes[structure.classes.length - 1];
      lastClass.methods.push({
        name,
        returnType: returnType || 'None',
        parameters: parsedParams.filter(p => p.name !== 'self' && p.name !== 'cls'),
        accessModifier: name.startsWith('_') ? 'private' : 'public',
      });
    } else {
      structure.functions.push({
        name,
        returnType: returnType || 'None',
        parameters: parsedParams,
      });
    }
  }

  return structure;
}

function parseParameters(paramStr) {
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map(p => {
    const trimmed = p.trim();
    if (!trimmed) return null;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const name = trimmed.slice(0, colonIdx).trim();
      let type = trimmed.slice(colonIdx + 1).trim();
      const eqIdx = type.indexOf('=');
      if (eqIdx !== -1) type = type.slice(0, eqIdx).trim();
      return { name, type };
    }

    const eqIdx = trimmed.indexOf('=');
    const name = eqIdx !== -1 ? trimmed.slice(0, eqIdx).trim() : trimmed;
    return { name, type: 'any' };
  }).filter(Boolean);
}

export const parseWithTreeSitter = null;
