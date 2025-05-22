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
            
            // Отключаем прокрутку на время загрузки сообщений
            messagesContainer.style.overflow = 'hidden';
            
            // Добавляем каждое сообщение из истории
            chatHistory.forEach(message => {
                addMessage(message.content, message.is_from_user ? 'user' : 'assistant', false);
            });
            
            // Включаем прокрутку и используем setTimeout для корректного измерения высоты
            messagesContainer.style.overflow = 'auto';
            setTimeout(() => {
                const scrollHeight = messagesContainer.scrollHeight;
                if (scrollHeight > 0) {
                    localStorage.setItem('chatScrollHeight', scrollHeight.toString());
                }
                messagesContainer.scrollTop = scrollHeight;
            }, 0);
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
        initAssistantListeners();
        await loadProfile();
        await loadChatHistory();
        initAssistantState();
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
    
    chatBody.addEventListener('show.bs.collapse', function () {
        localStorage.setItem('assistantState', 'false');
        setTimeout(() => {
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                // Получаем сохраненное значение
                const savedScrollHeight = localStorage.getItem('chatScrollHeight');
                if (savedScrollHeight) {
                    messagesContainer.scrollTop = parseInt(savedScrollHeight, 10);
                } else {
                    // Если сохраненного значения нет, используем текущую высоту
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            }
        }, 0);
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

    addMessage(message, 'user');
    input.value = '';
    
    try {
        showTypingAnimation();
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
        removeTypingAnimation();
        addMessage(data.message, 'assistant');
    } catch (error) {
        console.error('Ошибка:', error);
        removeTypingAnimation();
        addMessage('Извините, произошла ошибка. Попробуйте позже.', 'assistant');
    }
}

// Функция для добавления сообщения в чат ИИ-ассистенту
function addMessage(text, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    // Обрабатываем все сообщения как markdown
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
    
    messagesContainer.appendChild(messageDiv);

    const scrollHeight = messagesContainer.scrollHeight;

    if (scrollHeight > 0) {
        localStorage.setItem('chatScrollHeight', scrollHeight.toString());
    }
    messagesContainer.scrollTop = scrollHeight;
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

async function evaluateAnswer() {
    if (!checkAuth()) return;

    const questionText = document.querySelector('.question-text p').textContent;
    const userAnswer = document.getElementById('userAnswer').value.trim();
    
    // Получаем номер вопроса из URL
    const urlParams = new URLSearchParams(window.location.search);
    const questionNumber = urlParams.get('number');

    if (!questionText || !userAnswer || !questionNumber) {
        alert('Вопрос и ответ не могут быть пустыми');
        return;
    }

    try {
        showTypingAnimation();
        const response = await fetch('/api/chat/evaluate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
                question: questionText, 
                user_answer: userAnswer,
                question_number: parseInt(questionNumber)
            })
        });

        if (!response.ok) {
            throw new Error(`Ошибка при оценке ответа: ${response.statusText}`);
        }

        const data = await response.json();
        removeTypingAnimation();
        
        addMessage(data.user_answer, 'user');
        addMessage(data.evaluation, 'assistant');

        // Открываем ИИ-ассистента, если он свернут
        const chatBody = document.querySelector('#chatBody');
        const bsCollapse = new bootstrap.Collapse(chatBody, {
            toggle: false
        });
        bsCollapse.show();

    } catch (error) {
        console.error('Ошибка:', error);
        removeTypingAnimation();
        alert('Произошла ошибка при оценке ответа. Пожалуйста, попробуйте позже.');
    }
}

function showTypingAnimation() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant-message typing-animation';
    typingDiv.innerHTML = '<div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    typingDiv.id = 'typingAnimation';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingAnimation() {
    const typingDiv = document.getElementById('typingAnimation');
    if (typingDiv) {
        typingDiv.remove();
    }
}