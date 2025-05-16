// Функция для загрузки профиля пользователя (его имени) 
async function loadProfile() {
    if(!checkAuth()) return;
    
    try {
        const profile = await fetchApi('/api/profile');
        
        // Обновляем имя пользователя на всех страницах
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = profile.username;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        logout();
    }
}

// Функция для выхода из системы
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
} 

// Проверяем авторизацию при загрузке страниц dashboadrd.html, question.html, question_list.html
window.onload = function() {
    const token = localStorage.getItem('token');
    const isDashboard = window.location.pathname.includes('dashboard.html');
    const isQuestion = window.location.pathname.includes('question.html');
    const isQuestionList = window.location.pathname.includes('question_list.html');
    
    if (!token) {
        if (isDashboard || isQuestion || isQuestionList) {
            window.location.href = '/';
        }
        return;
    }
    
    // Загружаем профиль для всех авторизованных страниц
    if (isDashboard || isQuestion || isQuestionList) {
        loadProfile();
    }
};

// Функция для сворачивания/разворачивания виджета ИИ-ассистента
function toggleAssistant() {
    const widget = document.querySelector('.ai-assistant-widget');
    widget.classList.toggle('minimized');
}

// Функция для отправки сообщения ИИ-ассистенту
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

// Функция для добавления сообщения в чат ИИ-ассистенту
function addMessage(text, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Добавляем обработчик для отправки сообщений по Enter для отправки сообщений в чат ИИ-ассистенту
document.addEventListener('DOMContentLoaded', function() {
    const userMessageInput = document.getElementById('userMessage');
    
    if (userMessageInput) {
        userMessageInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });
    }
});

// Переход на страницу вопроса
function navigateToQuestionPage(event) {
    event.preventDefault();
    window.location.href = '/question.html';
}

// Переход на страницу списка вопросов
function navigateToQuestionsPage(event) {
    event.preventDefault();
    window.location.href = '/question_list.html';
}