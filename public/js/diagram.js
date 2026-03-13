// Diagram display + interaction

const Diagram = (() => {
  let diagrams = [];
  let currentModalDiagram = null;

  function init() {
    // Modal close handlers
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', closeModals);
    });

    document.getElementById('modal-download-svg').addEventListener('click', () => {
      if (currentModalDiagram) downloadSvg(currentModalDiagram);
    });

    document.getElementById('modal-download-png').addEventListener('click', () => {
      if (currentModalDiagram) downloadPng(currentModalDiagram);
    });

    document.getElementById('modal-copy-syntax').addEventListener('click', () => {
      if (currentModalDiagram) {
        copyToClipboard(currentModalDiagram.syntax);
        showToast('Syntax copied to clipboard');
      }
    });

    document.getElementById('edit-render-btn').addEventListener('click', reRenderEdit);
    document.getElementById('toggle-gallery-btn').addEventListener('click', toggleGallery);

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModals();
    });
  }

  function createInlineDiagram(diagramData) {
    const id = generateId();
    const el = document.createElement('div');
    el.className = 'inline-diagram';
    el.id = id;

    const sanitizedSvg = sanitizeSvg(diagramData.svg);

    el.innerHTML = `
      <div class="diagram-container">${sanitizedSvg}</div>
      <div class="diagram-actions">
        <button class="btn btn-ghost btn-sm diagram-action" data-action="fullscreen" title="Full Screen">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-sm diagram-action" data-action="download-svg" title="Download SVG">SVG</button>
        <button class="btn btn-ghost btn-sm diagram-action" data-action="download-png" title="Download PNG">PNG</button>
        <button class="btn btn-ghost btn-sm diagram-action" data-action="copy" title="Copy Syntax">Copy</button>
        <button class="btn btn-ghost btn-sm diagram-action" data-action="edit" title="Edit">Edit</button>
      </div>
    `;

    // Bind action buttons
    el.querySelectorAll('.diagram-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        switch (action) {
          case 'fullscreen':
            openFullscreen(diagramData);
            break;
          case 'download-svg':
            downloadSvg(diagramData);
            break;
          case 'download-png':
            downloadPng(diagramData);
            break;
          case 'copy':
            copyToClipboard(diagramData.syntax);
            showToast('Syntax copied to clipboard');
            break;
          case 'edit':
            openEditor(diagramData);
            break;
        }
      });
    });

    return el;
  }

  function openFullscreen(diagramData) {
    currentModalDiagram = diagramData;
    const modal = document.getElementById('diagram-modal');
    const container = document.getElementById('modal-diagram');
    container.innerHTML = sanitizeSvg(diagramData.svg);
    modal.classList.remove('hidden');
  }

  function openEditor(diagramData) {
    currentModalDiagram = diagramData;
    const modal = document.getElementById('edit-modal');
    document.getElementById('edit-syntax').value = diagramData.syntax;
    document.getElementById('edit-preview').innerHTML = sanitizeSvg(diagramData.svg);
    modal.classList.remove('hidden');
  }

  async function reRenderEdit() {
    const syntax = document.getElementById('edit-syntax').value;
    const preview = document.getElementById('edit-preview');
    const btn = document.getElementById('edit-render-btn');

    btn.disabled = true;
    btn.textContent = 'Rendering...';
    preview.innerHTML = '<div class="loading-state">Rendering...</div>';

    try {
      const response = await fetch('/api/diagram/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mermaidSyntax: syntax, outputFormat: 'svg', theme: 'dark' }),
      });

      const result = await response.json();

      if (result.success) {
        const sanitizedSvg = sanitizeSvg(result.data);
        preview.innerHTML = sanitizedSvg;

        // Update the diagram data
        if (currentModalDiagram) {
          currentModalDiagram.svg = result.data;
          currentModalDiagram.syntax = syntax;
        }
      } else {
        preview.innerHTML = `<div class="error-state">Render failed: ${escapeHtml(result.error)}</div>`;
      }
    } catch (err) {
      preview.innerHTML = `<div class="error-state">Error: ${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Re-render';
    }
  }

  function downloadSvg(diagramData) {
    downloadBlob(diagramData.svg, diagramData.filename || 'diagram.svg', 'image/svg+xml');
  }

  async function downloadPng(diagramData) {
    try {
      const response = await fetch('/api/diagram/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mermaidSyntax: diagramData.syntax, outputFormat: 'png', theme: 'dark' }),
      });

      const result = await response.json();
      if (result.success) {
        const binary = atob(result.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        downloadBlob(bytes, 'diagram.png', 'image/png');
      } else {
        showToast('PNG download failed: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      showToast('PNG download failed: ' + err.message);
    }
  }

  function addToGallery(diagramData) {
    diagrams.push(diagramData);
    updateGallery();
  }

  function clearGallery() {
    diagrams = [];
    updateGallery();
  }

  function updateGallery() {
    const gallery = document.getElementById('diagram-gallery');
    const thumbnails = document.getElementById('gallery-thumbnails');
    const count = document.getElementById('diagram-count');

    count.textContent = diagrams.length;

    if (diagrams.length === 0) {
      gallery.classList.add('hidden');
      return;
    }

    gallery.classList.remove('hidden');
    thumbnails.innerHTML = '';

    diagrams.forEach((d, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumbnail';
      thumb.innerHTML = sanitizeSvg(d.svg);
      thumb.addEventListener('click', () => openFullscreen(d));
      thumbnails.appendChild(thumb);
    });
  }

  function toggleGallery() {
    const thumbnails = document.getElementById('gallery-thumbnails');
    const btn = document.getElementById('toggle-gallery-btn');
    const isHidden = thumbnails.style.display === 'none';
    thumbnails.style.display = isHidden ? '' : 'none';
    btn.textContent = isHidden ? 'Collapse' : 'Expand';
  }

  function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  return { init, createInlineDiagram, addToGallery, clearGallery };
})();
