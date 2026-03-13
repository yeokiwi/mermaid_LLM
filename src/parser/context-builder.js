const MAX_CONTEXT_CHARS = 48000; // ~12,000 tokens at ~4 chars/token

export function buildContext(codebaseStructure) {
  if (codebaseStructure.error) {
    return `Error parsing codebase: ${codebaseStructure.error}`;
  }

  const lines = [];
  lines.push(`## Codebase Analysis: ${codebaseStructure.rootPath}`);
  lines.push(`Languages detected: ${codebaseStructure.languages.join(', ')}`);
  lines.push('');

  // Group files by language
  const byLanguage = {};
  for (const file of codebaseStructure.files) {
    if (!byLanguage[file.language]) byLanguage[file.language] = [];
    byLanguage[file.language].push(file);
  }

  for (const [language, files] of Object.entries(byLanguage)) {
    lines.push(`### ${languageLabel(language)} Files (${files.length} files)`);

    // Group by namespace
    const byNamespace = {};
    for (const file of files) {
      const ns = file.namespace || '(global)';
      if (!byNamespace[ns]) byNamespace[ns] = [];
      byNamespace[ns].push(file);
    }

    for (const [ns, nsFiles] of Object.entries(byNamespace)) {
      if (ns !== '(global)') {
        lines.push(`Namespace: ${ns}`);
      }

      for (const file of nsFiles) {
        for (const cls of file.classes) {
          let classLine = `  ${cls.kind === 'interface' ? 'Interface' : 'Class'} ${cls.name}`;
          const exts = [];
          if (cls.baseClasses.length > 0) exts.push(`extends ${cls.baseClasses.join(', ')}`);
          if (cls.interfaces && cls.interfaces.length > 0) exts.push(`implements ${cls.interfaces.join(', ')}`);
          if (exts.length > 0) classLine += ` (${exts.join(', ')})`;
          lines.push(classLine);

          if (cls.properties && cls.properties.length > 0) {
            const props = cls.properties.map(p => `${p.name} (${p.type})`).join(', ');
            lines.push(`    Properties: ${props}`);
          }

          if (cls.methods && cls.methods.length > 0) {
            const methods = cls.methods.map(m => {
              const params = m.parameters.map(p => p.type !== 'any' ? `${p.type}` : p.name).join(', ');
              return `${m.name}(${params})${m.returnType ? ' -> ' + m.returnType : ''}`;
            }).join(', ');
            lines.push(`    Methods: ${methods}`);
          }
        }

        for (const func of file.functions) {
          const params = func.parameters.map(p => p.type !== 'any' ? `${p.type}` : p.name).join(', ');
          lines.push(`  Function ${func.name}(${params})${func.returnType ? ' -> ' + func.returnType : ''}`);
        }

        for (const en of file.enums) {
          lines.push(`  Enum ${en.name}`);
        }
      }
    }

    lines.push('');
  }

  // Relationships
  if (codebaseStructure.relationships) {
    const { inheritance, dependencies } = codebaseStructure.relationships;
    if (inheritance.length > 0 || dependencies.length > 0) {
      lines.push('### Relationships');

      for (const rel of inheritance) {
        const arrow = rel.type === 'implements' ? '──implements──▶' : '──extends──▶';
        lines.push(`  ${rel.from} ${arrow} ${rel.to}`);
      }

      // Show unique dependency relationships (limit to keep context manageable)
      const uniqueDeps = new Map();
      for (const dep of dependencies) {
        const key = `${dep.from}|${dep.to}`;
        if (!uniqueDeps.has(key)) uniqueDeps.set(key, dep);
      }

      for (const dep of [...uniqueDeps.values()].slice(0, 50)) {
        lines.push(`  ${dep.from} ──depends on──▶ ${dep.to}`);
      }
    }
  }

  let result = lines.join('\n');

  // Truncation if too long
  if (result.length > MAX_CONTEXT_CHARS) {
    result = result.slice(0, MAX_CONTEXT_CHARS) + '\n\n[... truncated due to context size limits ...]';
  }

  return result;
}

function languageLabel(lang) {
  const labels = {
    csharp: 'C#',
    cpp: 'C++',
    python: 'Python',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
  };
  return labels[lang] || lang;
}
