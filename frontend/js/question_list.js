let currentQuestions = [];

// Функция для загрузки списка вопросов
async function loadQuestions() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch('/api/questions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки вопросов');
        }
        
        const questions = await response.json();
        currentQuestions = questions; // Сохраняем вопросы в глобальную переменную
        applyFiltersAndSort(); // Применяем фильтры и сортировку
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('questions-list').innerHTML = `
            <div class="no-questions">
                <i class="fas fa-exclamation-circle mb-3" style="font-size: 30px;"></i>
                <p>Произошла ошибка при загрузке вопросов. Пожалуйста, попробуйте позже.</p>
            </div>
        `;
    }
}

// Функция применения фильтров и сортировки
function applyFiltersAndSort() {
    let filteredQuestions = [...currentQuestions];
    
    // Применяем поиск по тексту
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    if (searchText) {
        filteredQuestions = filteredQuestions.filter(q => 
            q.question_text.toLowerCase().includes(searchText)
        );
    }
    
    // Применяем фильтр по статусу
    const statusFilter = document.getElementById('statusFilter').value;
    if (statusFilter !== 'all') {
        filteredQuestions = filteredQuestions.filter(q => 
            statusFilter === 'solved' ? q.is_solved : !q.is_solved
        );
    }
    
    // Применяем сортировку
    const sortType = document.getElementById('sortSelect').value;
    filteredQuestions.sort((a, b) => {
        switch (sortType) {
            case 'id':
                return a.id - b.id;
            case 'newest':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'oldest':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'answers':
                return (b.answers_count || 0) - (a.answers_count || 0);
            default:
                return a.id - b.id; // По умолчанию сортируем по ID
        }
    });
    
    displayQuestions(filteredQuestions);
}

// Добавляем обработчики событий для фильтров
document.addEventListener('DOMContentLoaded', function() {
    // Устанавливаем значение сортировки по умолчанию
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.value = 'id';
    
    loadQuestions();
    
    // Обработчики изменений в фильтрах
    document.getElementById('searchInput').addEventListener('input', applyFiltersAndSort);
    document.getElementById('sortSelect').addEventListener('change', applyFiltersAndSort);
    document.getElementById('statusFilter').addEventListener('change', applyFiltersAndSort);
});

// Функция для отображения списка вопросов
function displayQuestions(questions) {
    const questionsListElement = document.getElementById('questions-list');
    
    if (!questions || questions.length === 0) {
        questionsListElement.innerHTML = `
            <div class="no-questions">
                <i class="fas fa-inbox mb-3" style="font-size: 30px;"></i>
                <p>В базе данных пока нет вопросов. Добавьте первый вопрос!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    questions.forEach(question => {
        const date = new Date(question.created_at);
        const formattedDate = date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        // Преобразуем строковое значение в булево
        const isSolved = question.is_solved === 'true' || question.is_solved === true;
        
        html += `
            <div class="question-item" onclick="navigateToQuestion(${question.id})">
                <div class="d-flex justify-content-between align-items-start">
                    <h4>Вопрос #${question.id}</h4>
                    ${isSolved ? '<span class="solved-indicator"><i class="fas fa-check-circle"></i></span>' : ''}
                </div>
                <p>${truncateText(question.question_text, 150)}</p>
                <div class="meta">
                    <span><i class="far fa-calendar-alt me-1"></i> ${formattedDate}</span>
                    <span><i class="far fa-comments me-1"></i> ${question.answers_count || 0} ответов</span>
                </div>
            </div>
        `;
    });
    
    questionsListElement.innerHTML = html;
}

// Функция для обрезки текста
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Функция для перехода на страницу вопроса
async function navigateToQuestion(questionId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        const response = await fetch(`/api/questions/${questionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки вопроса');
        }

        // Сохраняем данные вопроса в localStorage для передачи на следующую страницу
        const question = await response.json();
        localStorage.setItem('currentQuestion', JSON.stringify(question));
        
        // Переходим на страницу вопроса
        window.location.href = `/question.html?id=${question.id}`;
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.');
    }
}

function displayQuestionDetails(question) {
    const questionsListElement = document.getElementById('questions-list');
    questionsListElement.innerHTML = `
        <div class="question-details">
            <h3>Вопрос #${question.id}</h3>
            <div class="question-content">
                <p>${question.question}</p>
            </div>
            ${question.is_solved ? '<div class="solved-badge"><i class="fas fa-check-circle"></i> Решено</div>' : ''}
            <button class="submit-btn mt-3" onclick="loadQuestions()">
                <i class="fas fa-arrow-left me-2"></i>
                Вернуться к списку
            </button>
        </div>
    `;
}

// Функция для отображения модального окна добавления вопроса
function showAddQuestionModal() {
    const modal = new bootstrap.Modal(document.getElementById('addQuestionModal'));
    modal.show();
}

// Функция для добавления нового вопроса
async function addQuestion() {
    const questionText = document.getElementById('questionText').value.trim();
    
    if (!questionText) {
        alert('Пожалуйста, введите текст вопроса');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch('/api/questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: questionText })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при добавлении вопроса');
        }
        
        const result = await response.json();
        
        // Закрываем модальное окно
        const modal = bootstrap.Modal.getInstance(document.getElementById('addQuestionModal'));
        modal.hide();
        
        // Очищаем поле ввода
        document.getElementById('questionText').value = '';
        
        // Перезагружаем список вопросов
        loadQuestions();
        
        // Показываем уведомление об успешном добавлении
        alert('Вопрос успешно добавлен!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при добавлении вопроса. Пожалуйста, попробуйте позже.');
    }
}