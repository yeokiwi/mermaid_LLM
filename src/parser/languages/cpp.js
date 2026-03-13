import fs from 'fs/promises';
import { createEmptyFileStructure } from '../common.js';

const patterns = {
  namespace: /namespace\s+(\w+)\s*\{/g,
  class: /class\s+(\w+)(?:\s*:\s*([\w\s,<>:]+))?\s*\{/g,
  struct: /struct\s+(\w+)(?:\s*:\s*([\w\s,<>:]+))?\s*\{/g,
  function: /(?:[\w:*&<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:\{|;)/g,
  include: /#include\s*[<"]([^>"]+)[>"]/g,
  template: /template\s*<([^>]+)>/g,
  enum: /enum\s+(?:class\s+)?(\w+)/g,
};

export async function parseWithRegex(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const structure = createEmptyFileStructure(filePath, 'cpp');

  let match;

  // Extract namespace
  const nsMatch = patterns.namespace.exec(content);
  if (nsMatch) structure.namespace = nsMatch[1];
  patterns.namespace.lastIndex = 0;

  // Extract includes
  while ((match = patterns.include.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.include.lastIndex = 0;

  // Extract enums
  while ((match = patterns.enum.exec(content)) !== null) {
    structure.enums.push({ name: match[1] });
  }
  patterns.enum.lastIndex = 0;

  // Extract classes
  while ((match = patterns.class.exec(content)) !== null) {
    const name = match[1];
    const inheritance = match[2] ? match[2].split(',').map(b => b.replace(/public|private|protected|virtual/g, '').trim()).filter(Boolean) : [];
    structure.classes.push({
      name,
      kind: 'class',
      baseClasses: inheritance,
      interfaces: [],
      accessModifier: 'public',
      methods: [],
      properties: [],
    });
  }
  patterns.class.lastIndex = 0;

  // Extract structs
  while ((match = patterns.struct.exec(content)) !== null) {
    const name = match[1];
    const inheritance = match[2] ? match[2].split(',').map(b => b.replace(/public|private|protected/g, '').trim()).filter(Boolean) : [];
    structure.classes.push({
      name,
      kind: 'struct',
      baseClasses: inheritance,
      interfaces: [],
      accessModifier: 'public',
      methods: [],
      properties: [],
    });
  }
  patterns.struct.lastIndex = 0;

  // Extract functions
  while ((match = patterns.function.exec(content)) !== null) {
    const name = match[1];
    if (['if', 'while', 'for', 'switch', 'catch', 'return', 'delete', 'new'].includes(name)) continue;
    const returnType = extractReturnType(match[0], name);
    structure.functions.push({
      name,
      returnType,
      parameters: parseParameters(match[2]),
    });
  }
  patterns.function.lastIndex = 0;

  return structure;
}

function extractReturnType(str, funcName) {
  const before = str.split(funcName)[0].trim();
  const tokens = before.split(/\s+/);
  return tokens.length > 0 ? tokens[tokens.length - 1] : 'void';
}

function parseParameters(paramStr) {
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { type: parts.slice(0, -1).join(' '), name: parts[parts.length - 1].replace(/[*&]/g, '') };
    }
    return { type: 'unknown', name: parts[0] };
  });
}

export const parseWithTreeSitter = null;
