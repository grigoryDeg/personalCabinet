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
    
    chatBody.addEventListener('shown.bs.collapse', function () {
        localStorage.setItem('assistantState', 'false');
        
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });
    
    chatBody.addEventListener('hide.bs.collapse', function () {
        localStorage.setItem('assistantState', 'true');
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
    
    // Если это сообщение от ассистента, обрабатываем его как markdown
    if (type === 'assistant') {
        messageDiv.innerHTML = marked.parse(text);
        // Добавляем стили для code блоков
        const codeBlocks = messageDiv.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            block.style.backgroundColor = '#f8f9fa';
            block.style.padding = '1rem';
            block.style.borderRadius = '4px';
            block.style.display = 'block';
            block.style.overflowX = 'auto';
        });
    } else {
        // Для сообщений пользователя используем тот же шрифт, но без markdown
        messageDiv.innerHTML = `<p>${text}</p>`;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Обновляем также обработчик события shown.bs.collapse
chatBody.addEventListener('shown.bs.collapse', function () {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        const lastMessage = messagesContainer.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
});

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

async function evaluateAnswer() {
    if (!checkAuth()) return;

    const questionText = document.querySelector('.question-text p').textContent;
    const userAnswer = document.getElementById('userAnswer').value.trim();

    if (!questionText || !userAnswer) {
        alert('Вопрос и ответ не могут быть пустыми');
        return;
    }

    try {
        const response = await fetch('/api/chat/evaluate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ question: questionText, user_answer: userAnswer })
        });

        if (!response.ok) {
            throw new Error(`Ошибка при оценке ответа: ${response.statusText}`);
        }

        const data = await response.json();
        addMessage(data.evaluation, 'assistant'); // Используем data.evaluation для добавления сообщения

        // Открываем ИИ-ассистента, если он свернут
        const chatBody = document.querySelector('#chatBody');
        const bsCollapse = new bootstrap.Collapse(chatBody, {
            toggle: false
        });
        bsCollapse.show();

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при оценке ответа. Пожалуйста, попробуйте позже.');
    }
}

document.querySelector('.submit-btn').addEventListener('click', async function() {
    const aiCheckBtn = document.querySelector('.ai-check-btn');
    if (aiCheckBtn.classList.contains('active')) {
        document.querySelector('.question-card').classList.add('flipped');
        await evaluateAnswer();
    }
});