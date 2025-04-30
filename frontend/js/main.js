async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка авторизации');
        }
        
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        
        // Перенаправляем на страницу дашборда
        window.location.href = '/dashboard.html';
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

async function loadProfile() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch('/api/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки профиля');
        }
        
        const profile = await response.json();
        
        // Определяем, на какой странице мы находимся
        const isDashboard = window.location.pathname.includes('dashboard.html');
        
        if (isDashboard) {
            document.getElementById('username').textContent = profile.username;
        } else {
            document.getElementById('profileData').innerHTML = `
                <h3>Добро пожаловать, ${profile.username}!</h3>
            `;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        logout();
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
} 

// Проверяем авторизацию при загрузке страницы
window.onload = function() {
    const token = localStorage.getItem('token');
    const isDashboard = window.location.pathname.includes('dashboard.html');
    
    if (!token) {
        if (isDashboard) {
            window.location.href = '/';
        }
        return;
    }
    
    if (isDashboard) {
        loadProfile();
    } else {
        // Если мы на главной странице и есть токен,
        // перенаправляем на dashboard
        window.location.href = '/dashboard.html';
    }
};

function toggleAssistant() {
    const widget = document.querySelector('.ai-assistant-widget');
    widget.classList.toggle('minimized');
}

async function sendMessage() {
    const input = document.getElementById('userMessage');
    const message = input.value.trim();
    if (!message) return;

    // Добавляем сообщение пользователя
    addMessage(message, 'user');
    input.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error('Ошибка при отправке сообщения');
        }

        const data = await response.json();
        addMessage(data.response, 'assistant');
    } catch (error) {
        console.error('Ошибка:', error);
        addMessage('Извините, произошла ошибка. Попробуйте позже.', 'assistant');
    }
}

function addMessage(text, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}