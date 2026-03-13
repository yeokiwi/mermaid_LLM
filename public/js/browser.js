// Directory browser logic

const Browser = (() => {
  let currentPath = '';
  let selectedFiles = new Set();
  let entries = [];

  function init() {
    document.getElementById('path-go-btn').addEventListener('click', navigateToInput);
    document.getElementById('path-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') navigateToInput();
    });
    document.getElementById('parse-attach-btn').addEventListener('click', parseAndAttach);
    document.getElementById('attach-code-btn').addEventListener('click', () => {
      // Switch to browser tab
      switchTab('browser');
    });

    // Language filter changes
    document.querySelectorAll('.lang-filter').forEach(cb => {
      cb.addEventListener('change', renderFileTree);
    });
  }

  function navigateToInput() {
    const input = document.getElementById('path-input');
    const path = input.value.trim();
    if (path) navigateTo(path);
  }

  async function navigateTo(dirPath) {
    try {
      const response = await fetch(`/api/browse?path=${encodeURIComponent(dirPath)}`);
      const data = await response.json();

      if (!response.ok) {
        showBrowserError(data.error || 'Failed to browse directory');
        return;
      }

      currentPath = data.currentPath;
      entries = data.entries;
      document.getElementById('path-input').value = currentPath;

      renderBreadcrumbs(data.currentPath, data.parent);
      renderFileTree();
    } catch (err) {
      showBrowserError(err.message);
    }
  }

  function renderBreadcrumbs(currentPath, parent) {
    const el = document.getElementById('breadcrumbs');
    const parts = currentPath.split('/').filter(Boolean);
    let html = '';
    let accumulated = '';

    for (let i = 0; i < parts.length; i++) {
      accumulated += '/' + parts[i];
      const path = accumulated;
      if (i === parts.length - 1) {
        html += `<span class="breadcrumb-current">${escapeHtml(parts[i])}</span>`;
      } else {
        html += `<a class="breadcrumb-link" href="#" data-path="${escapeHtml(path)}">${escapeHtml(parts[i])}</a><span class="breadcrumb-sep">/</span>`;
      }
    }

    el.innerHTML = html;

    el.querySelectorAll('.breadcrumb-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.path);
      });
    });
  }

  function renderFileTree() {
    const fileTree = document.getElementById('file-tree');
    const activeLanguages = getActiveLanguages();

    if (entries.length === 0) {
      fileTree.innerHTML = '<div class="empty-state">No entries found</div>';
      return;
    }

    let html = '';

    for (const entry of entries) {
      if (entry.type === 'directory') {
        html += `
          <div class="file-entry directory-entry" data-path="${escapeHtml(entry.path)}">
            <span class="file-icon">&#128193;</span>
            <span class="file-name">${escapeHtml(entry.name)}</span>
          </div>
        `;
      } else {
        // Filter by language
        if (entry.language && !activeLanguages.includes(entry.language)) continue;

        const checked = selectedFiles.has(entry.path) ? 'checked' : '';
        const langBadge = entry.language ? `<span class="lang-badge lang-${entry.language}">${langLabel(entry.language)}</span>` : '';

        html += `
          <div class="file-entry" data-path="${escapeHtml(entry.path)}">
            <input type="checkbox" class="file-checkbox" data-path="${escapeHtml(entry.path)}" ${checked}>
            <span class="file-icon">${getFileIcon(entry.language)}</span>
            <span class="file-name clickable-file" data-path="${escapeHtml(entry.path)}">${escapeHtml(entry.name)}</span>
            ${langBadge}
            <span class="file-size">${formatFileSize(entry.size)}</span>
          </div>
        `;
      }
    }

    fileTree.innerHTML = html;

    // Bind events
    fileTree.querySelectorAll('.directory-entry').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.path));
    });

    fileTree.querySelectorAll('.file-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedFiles.add(cb.dataset.path);
        } else {
          selectedFiles.delete(cb.dataset.path);
        }
        updateSelectionFooter();
      });
    });

    fileTree.querySelectorAll('.clickable-file').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        previewFile(el.dataset.path);
      });
    });

    updateSelectionFooter();
  }

  function getActiveLanguages() {
    const active = [];
    document.querySelectorAll('.lang-filter:checked').forEach(cb => {
      active.push(cb.value);
    });
    return active;
  }

  function updateSelectionFooter() {
    const footer = document.getElementById('selection-footer');
    const summary = document.getElementById('selection-summary');
    const count = selectedFiles.size;

    if (count > 0) {
      footer.classList.remove('hidden');
      const languages = new Set();
      for (const filePath of selectedFiles) {
        const entry = entries.find(e => e.path === filePath);
        if (entry && entry.language) languages.add(entry.language);
      }
      summary.textContent = `${count} file${count > 1 ? 's' : ''} selected across ${languages.size} language${languages.size > 1 ? 's' : ''}`;
    } else {
      footer.classList.add('hidden');
    }
  }

  async function previewFile(filePath) {
    switchTab('preview');
    const preview = document.getElementById('code-preview');
    preview.innerHTML = '<div class="loading-state">Loading...</div>';

    try {
      const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();

      if (!response.ok) {
        preview.innerHTML = `<div class="error-state">${escapeHtml(data.error)}</div>`;
        return;
      }

      const langClass = data.language ? `language-${data.language}` : '';
      preview.innerHTML = `
        <div class="preview-header">
          <span class="preview-filename">${escapeHtml(data.path)}</span>
          <span class="preview-meta">${data.lines} lines | ${formatFileSize(data.sizeBytes)}</span>
        </div>
        <pre class="preview-code"><code class="${langClass}">${escapeHtml(data.content)}</code></pre>
      `;
    } catch (err) {
      preview.innerHTML = `<div class="error-state">Failed to load file: ${escapeHtml(err.message)}</div>`;
    }
  }

  async function parseAndAttach() {
    if (selectedFiles.size === 0) return;

    const btn = document.getElementById('parse-attach-btn');
    btn.disabled = true;
    btn.textContent = 'Parsing...';

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootPath: currentPath,
          selectedFiles: [...selectedFiles].map(f => f),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Parse failed');
        return;
      }

      Chat.setCodeContext({
        rootPath: currentPath,
        selectedFiles: [...selectedFiles],
        parsedStructure: data,
      });

      switchTab('browser');
    } catch (err) {
      alert(`Parse failed: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Parse & Attach to Chat';
    }
  }

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab-${tabName}`);
    });
  }

  function showBrowserError(message) {
    document.getElementById('file-tree').innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
  }

  function getFileIcon(language) {
    const icons = {
      csharp: '&#9839;',
      cpp: '&#9883;',
      python: '&#128013;',
      javascript: '&#9998;',
      typescript: '&#9878;',
    };
    return icons[language] || '&#128196;';
  }

  function langLabel(lang) {
    const labels = { csharp: 'C#', cpp: 'C++', python: 'PY', javascript: 'JS', typescript: 'TS' };
    return labels[lang] || lang;
  }

  // Expose tab switching
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  });

  return { init, navigateTo, switchTab };
})();
