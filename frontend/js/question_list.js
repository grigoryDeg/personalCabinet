// Загрузка списка вопросов при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadQuestions();
});

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
        displayQuestions(questions);
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
        
        html += `
            <div class="question-item" onclick="navigateToQuestion(${question.id})">
                <h4>Вопрос #${question.id}</h4>
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
function navigateToQuestion(questionId) {
    window.location.href = `/question.html?id=${questionId}`;
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