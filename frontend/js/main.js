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

// Функция для загрузки истории чата
async function loadChatHistory() {
    if(!checkAuth()) return;
    
    try {
        const chatHistory = await fetchApi('/api/chat/history');
        const messagesContainer = document.getElementById('chatMessages');
        
        if (messagesContainer && chatHistory.length > 0) {
            // Очищаем контейнер сообщений перед добавлением истории
            messagesContainer.innerHTML = '';
            
            // Добавляем каждое сообщение из истории
            chatHistory.forEach(message => {
                addMessage(message.content, message.is_from_user ? 'user' : 'assistant');
            });
            
            // Прокручиваем к последнему сообщению
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (error) {
        console.error('Ошибка при загрузке истории чата:', error);
    }
}

// Функция для выхода из системы
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
} 

// Проверяем авторизацию при загрузке страниц dashboadrd.html, question.html, question_list.html
window.onload = async function() {
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
        await loadProfile();
        await loadChatHistory();
        initAssistantState();
        initAssistantListeners();
    }
};

// Инициализация состояния чата
function initAssistantState() {
    const chatBody = document.querySelector('#chatBody');
    if (!chatBody) return;
    
    const savedState = localStorage.getItem('assistantState');
    console.log('Загружено состояние:', savedState);
    
    // Инициализируем collapse через Bootstrap
    const bsCollapse = new bootstrap.Collapse(chatBody, {
        toggle: false
    });
    
    if (savedState === 'true') {
        bsCollapse.hide();
    } else {
        bsCollapse.show();
    }
}

// Добавляем слушатели событий Bootstrap
function initAssistantListeners() {
    const chatBody = document.querySelector('#chatBody');
    if (!chatBody) return;
    
    chatBody.addEventListener('show.bs.collapse', function () {
        localStorage.setItem('assistantState', 'false');
        console.log('Сохранено состояние: развернут');
    });
    
    chatBody.addEventListener('hide.bs.collapse', function () {
        localStorage.setItem('assistantState', 'true');
        console.log('Сохранено состояние: свернут');
    });
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
        const response = await fetch('/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ content: message })
        });

        if (!response.ok) {
            throw new Error('Ошибка при отправке сообщения');
        }

        const data = await response.json();
        addMessage(data.message, 'assistant');
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