// Main application controller

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize modules
  Chat.init();
  Browser.init();
  Diagram.init();

  // Check backend health
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    const statusEl = document.getElementById('mcp-status');

    if (data.mcpAvailable) {
      statusEl.textContent = 'MCP: Connected';
      statusEl.className = 'status-badge status-connected';
    } else {
      statusEl.textContent = 'MCP: Unavailable';
      statusEl.className = 'status-badge status-error';
    }
  } catch (err) {
    const statusEl = document.getElementById('mcp-status');
    statusEl.textContent = 'Backend: Offline';
    statusEl.className = 'status-badge status-error';
  }
});
