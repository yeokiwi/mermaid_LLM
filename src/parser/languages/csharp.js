import fs from 'fs/promises';
import { createEmptyFileStructure } from '../common.js';

const patterns = {
  namespace: /namespace\s+([\w.]+)/g,
  class: /(?:public|private|internal|protected|abstract|sealed|static)?\s*class\s+(\w+)(?:\s*:\s*([\w\s,.<>]+))?/g,
  interface: /(?:public|internal)?\s*interface\s+(\w+)(?:\s*:\s*([\w\s,.<>]+))?/g,
  method: /(?:public|private|protected|internal|static|virtual|override|abstract|async)[\s\w<>\[\]?]*\s+(\w+)\s*\(([^)]*)\)/g,
  property: /(?:public|private|protected|internal|static)[\s\w<>\[\]?]*\s+(\w+)\s*\{\s*get/g,
  using: /using\s+([\w.]+);/g,
  enum: /enum\s+(\w+)/g,
};

export async function parseWithRegex(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const structure = createEmptyFileStructure(filePath, 'csharp');

  // Extract namespace
  const nsMatch = patterns.namespace.exec(content);
  if (nsMatch) structure.namespace = nsMatch[1];
  patterns.namespace.lastIndex = 0;

  // Extract imports
  let match;
  while ((match = patterns.using.exec(content)) !== null) {
    structure.imports.push(match[1]);
  }
  patterns.using.lastIndex = 0;

  // Extract enums
  while ((match = patterns.enum.exec(content)) !== null) {
    structure.enums.push({ name: match[1] });
  }
  patterns.enum.lastIndex = 0;

  // Extract interfaces
  while ((match = patterns.interface.exec(content)) !== null) {
    const name = match[1];
    const bases = match[2] ? match[2].split(',').map(b => b.trim()).filter(Boolean) : [];
    structure.classes.push({
      name,
      kind: 'interface',
      baseClasses: [],
      interfaces: bases,
      accessModifier: 'public',
      methods: [],
      properties: [],
    });
  }
  patterns.interface.lastIndex = 0;

  // Extract classes
  while ((match = patterns.class.exec(content)) !== null) {
    const name = match[1];
    const inheritance = match[2] ? match[2].split(',').map(b => b.trim()).filter(Boolean) : [];
    const baseClasses = inheritance.filter(i => !i.startsWith('I') || i.length <= 1);
    const interfaces = inheritance.filter(i => i.startsWith('I') && i.length > 1);

    structure.classes.push({
      name,
      kind: 'class',
      baseClasses,
      interfaces,
      accessModifier: extractAccessModifier(match[0]),
      methods: [],
      properties: [],
    });
  }
  patterns.class.lastIndex = 0;

  // Extract methods and properties (attach to last class found)
  const methods = [];
  while ((match = patterns.method.exec(content)) !== null) {
    const name = match[1];
    if (['if', 'while', 'for', 'switch', 'catch', 'using', 'return'].includes(name)) continue;
    methods.push({
      name,
      returnType: extractReturnType(match[0], name),
      parameters: parseParameters(match[2]),
      accessModifier: extractAccessModifier(match[0]),
    });
  }
  patterns.method.lastIndex = 0;

  const properties = [];
  while ((match = patterns.property.exec(content)) !== null) {
    properties.push({
      name: match[1],
      type: extractPropertyType(match[0], match[1]),
      accessModifier: extractAccessModifier(match[0]),
    });
  }
  patterns.property.lastIndex = 0;

  // Assign methods and properties to the last class if available
  if (structure.classes.length > 0) {
    const lastClass = structure.classes[structure.classes.length - 1];
    lastClass.methods = methods;
    lastClass.properties = properties;
  } else {
    structure.functions = methods.map(m => ({
      name: m.name,
      returnType: m.returnType,
      parameters: m.parameters,
    }));
  }

  return structure;
}

function extractAccessModifier(str) {
  if (str.includes('public')) return 'public';
  if (str.includes('private')) return 'private';
  if (str.includes('protected')) return 'protected';
  if (str.includes('internal')) return 'internal';
  return 'private';
}

function extractReturnType(str, methodName) {
  const before = str.split(methodName)[0].trim();
  const tokens = before.split(/\s+/);
  const modifiers = new Set(['public', 'private', 'protected', 'internal', 'static', 'virtual', 'override', 'abstract', 'async']);
  const typeTokens = tokens.filter(t => !modifiers.has(t));
  return typeTokens.length > 0 ? typeTokens[typeTokens.length - 1] : 'void';
}

function extractPropertyType(str, propName) {
  const before = str.split(propName)[0].trim();
  const tokens = before.split(/\s+/);
  const modifiers = new Set(['public', 'private', 'protected', 'internal', 'static']);
  const typeTokens = tokens.filter(t => !modifiers.has(t));
  return typeTokens.length > 0 ? typeTokens[typeTokens.length - 1] : 'unknown';
}

function parseParameters(paramStr) {
  if (!paramStr.trim()) return [];
  return paramStr.split(',').map(p => {
    const parts = p.trim().split(/\s+/);
    if (parts.length >= 2) {
      return { type: parts.slice(0, -1).join(' '), name: parts[parts.length - 1] };
    }
    return { type: 'unknown', name: parts[0] };
  });
}

export const parseWithTreeSitter = null; // Tree-sitter implementation placeholder
