const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageUpload = document.getElementById('imageUpload');

let currentImageBase64 = null;

// Auto resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

// Kirim pesan dengan Enter (Shift+Enter untuk new line)
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// Upload gambar
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showError('Hanya file gambar yang diperbolehkan');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showError('Ukuran gambar maksimal 5MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        currentImageBase64 = e.target.result;
        addSystemMessage(`📷 Gambar terupload: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    };
    reader.onerror = () => {
        showError('Gagal membaca gambar');
    };
    reader.readAsDataURL(file);
    
    imageUpload.value = '';
});

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message && !currentImageBase64) return;

    // Tampilkan pesan user
    if (message) {
        addMessage(message, 'user');
    } else if (currentImageBase64) {
        addMessage('[Gambar dikirim]', 'user');
    }
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Tampilkan loading
    const loadingId = addLoadingMessage();
    
    try {
        // Gunakan edge function untuk streaming (jika ada)
        const useStream = true; // Set false jika ingin non-streaming
        
        if (useStream) {
            await sendWithStream(message, loadingId);
        } else {
            await sendWithoutStream(message, loadingId);
        }
        
        // Clear current image setelah terkirim
        currentImageBase64 = null;
        
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage(loadingId);
        showError('Gagal mengirim pesan. Periksa koneksi atau API key.');
    }
}

async function sendWithStream(message, loadingId) {
    const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message || 'Deskripsikan gambar ini',
            image: currentImageBase64
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    removeLoadingMessage(loadingId);
    
    const aiMessageDiv = createAIMessageContainer();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    break;
                }
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.token) {
                        accumulatedText += parsed.token;
                        updateAIMessage(aiMessageDiv, accumulatedText);
                        scrollToBottom();
                    }
                } catch (e) {
                    // Ignore parse error
                }
            }
        }
    }
}

async function sendWithoutStream(message, loadingId) {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message || 'Deskripsikan gambar ini',
            image: currentImageBase64
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    removeLoadingMessage(loadingId);
    addMessage(data.reply, 'ai');
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender === 'user' ? 'user-message' : 'ai-message'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ai-message`;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.style.background = '#2a2a2a';
    contentDiv.style.fontSize = '0.85rem';
    contentDiv.style.fontStyle = 'italic';
    contentDiv.textContent = text;
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

function addLoadingMessage() {
    const id = 'loading-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.id = id;
    messageDiv.className = 'message ai-message';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<div class="loading"></div><span style="margin-left: 8px;">AI sedang berpikir...</span>';
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    return id;
}

function removeLoadingMessage(id) {
    const loadingDiv = document.getElementById(id);
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function createAIMessageContainer() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    messageDiv.id = 'streaming-' + Date.now();
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = '';
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    return messageDiv;
}

function updateAIMessage(container, text) {
    const contentDiv = container.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.textContent = text;
    }
}

function showError(errorText) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.style.background = '#4a1a1a';
    contentDiv.style.border = '1px solid #8a2a2a';
    contentDiv.textContent = `⚠️ Error: ${errorText}`;
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}