// Chat panel logic + SSE handling

const Chat = (() => {
  let conversationHistory = [];
  let isStreaming = false;
  let codeContext = null;

  function init() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const clearBtn = document.getElementById('clear-chat-btn');
    const clearContextBtn = document.getElementById('clear-context-btn');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrentMessage();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    });

    sendBtn.addEventListener('click', sendCurrentMessage);
    clearBtn.addEventListener('click', clearChat);
    clearContextBtn.addEventListener('click', clearCodeContext);

    // Quick action buttons
    document.querySelectorAll('.quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.prompt;
        sendCurrentMessage();
      });
    });
  }

  function sendCurrentMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message || isStreaming) return;

    input.value = '';
    input.style.height = 'auto';

    sendMessage(message);
  }

  async function sendMessage(message) {
    isStreaming = true;
    updateSendButton(true);

    // Remove welcome message
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // Add user message
    appendMessage('user', message);
    conversationHistory.push({ role: 'user', content: message });

    // Create assistant message placeholder
    const assistantEl = appendMessage('assistant', '', true);
    const contentEl = assistantEl.querySelector('.message-content');
    let fullContent = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory: conversationHistory.slice(-20), // Keep last 20 messages
          codeContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, consumed } = parseSSEEvents(buffer);
        buffer = buffer.slice(consumed);

        for (const event of events) {
          handleSSEEvent(event, contentEl, assistantEl, (text) => { fullContent += text; });
        }
      }
    } catch (err) {
      contentEl.innerHTML = `<div class="error-message">Error: ${escapeHtml(err.message)}</div>`;
    }

    if (fullContent) {
      conversationHistory.push({ role: 'assistant', content: fullContent });
    }

    isStreaming = false;
    updateSendButton(false);
  }

  function handleSSEEvent(event, contentEl, messageEl, appendContent) {
    switch (event.type) {
      case 'token': {
        const text = event.parsedData.content || '';
        appendContent(text);
        contentEl.innerHTML = renderMarkdown(text);
        scrollToBottom();
        break;
      }
      case 'tool_call': {
        const badge = document.createElement('div');
        badge.className = 'tool-badge';
        badge.textContent = `Calling ${event.parsedData.tool}...`;
        messageEl.querySelector('.message-body').appendChild(badge);
        scrollToBottom();
        break;
      }
      case 'tool_result': {
        // Update last tool badge
        const badges = messageEl.querySelectorAll('.tool-badge');
        const lastBadge = badges[badges.length - 1];
        if (lastBadge) {
          lastBadge.textContent = `${event.parsedData.tool} completed`;
          lastBadge.classList.add('tool-badge-done');
        }
        break;
      }
      case 'diagram': {
        const diagramData = event.parsedData;
        const diagramEl = Diagram.createInlineDiagram(diagramData);
        messageEl.querySelector('.message-body').appendChild(diagramEl);
        Diagram.addToGallery(diagramData);
        scrollToBottom();
        break;
      }
      case 'error': {
        contentEl.innerHTML += `<div class="error-message">Error: ${escapeHtml(event.parsedData.message)}</div>`;
        scrollToBottom();
        break;
      }
      case 'done':
        break;
    }
  }

  function appendMessage(role, content, isPlaceholder = false) {
    const messages = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = `message message-${role}`;

    const avatar = role === 'user' ? '&#128100;' : '&#129302;';
    const sender = role === 'user' ? 'You' : 'Assistant';

    el.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-body">
        <div class="message-header">
          <span class="message-sender">${sender}</span>
          <span class="message-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="message-content">${isPlaceholder ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : renderMarkdown(content)}</div>
      </div>
    `;

    messages.appendChild(el);
    scrollToBottom();
    return el;
  }

  function scrollToBottom() {
    const messages = document.getElementById('chat-messages');
    messages.scrollTop = messages.scrollHeight;
  }

  function updateSendButton(loading) {
    const btn = document.getElementById('send-btn');
    const input = document.getElementById('chat-input');
    btn.disabled = loading;
    input.disabled = loading;
    if (loading) {
      btn.innerHTML = '<div class="spinner-sm"></div>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    }
  }

  function clearChat() {
    conversationHistory = [];
    const messages = document.getElementById('chat-messages');
    messages.innerHTML = `
      <div class="welcome-message">
        <h3>Welcome to Mermaid Diagram Generator</h3>
        <p>Ask me to create any type of diagram, or browse your source code to generate diagrams from your codebase.</p>
        <div class="quick-actions">
          <button class="btn btn-outline quick-action" data-prompt="Create a flowchart showing a user login process">Flowchart: Login</button>
          <button class="btn btn-outline quick-action" data-prompt="Create a sequence diagram for a REST API request">Sequence: API</button>
          <button class="btn btn-outline quick-action" data-prompt="Create a class diagram for a basic e-commerce system">Class: E-Commerce</button>
          <button class="btn btn-outline quick-action" data-prompt="List all available diagram types">List Types</button>
        </div>
      </div>
    `;
    // Re-bind quick actions
    messages.querySelectorAll('.quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('chat-input').value = btn.dataset.prompt;
        sendCurrentMessage();
      });
    });
    Diagram.clearGallery();
  }

  function setCodeContext(ctx) {
    codeContext = ctx;
    const banner = document.getElementById('code-context-banner');
    const summary = document.getElementById('context-summary');

    if (ctx) {
      let classCount = 0, funcCount = 0;
      for (const file of ctx.parsedStructure.files) {
        classCount += file.classes.length;
        funcCount += file.functions.length;
      }
      summary.textContent = `Code context: ${classCount} classes, ${funcCount} functions across ${ctx.parsedStructure.files.length} files`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  function clearCodeContext() {
    codeContext = null;
    document.getElementById('code-context-banner').classList.add('hidden');
  }

  return { init, sendMessage, setCodeContext, clearCodeContext };
})();
