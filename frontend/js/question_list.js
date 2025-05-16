let currentQuestions = [];
let isEditMode = false;
let selectedQuestions = [];

// Функция для загрузки списка вопросов
async function loadQuestions() {
    if(!checkAuth()) return;
    
    try {
        const questions = await fetchApi('/api/questions');
        currentQuestions = questions;
        applyFiltersAndSort();
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
        const isSolved = statusFilter === 'solved';
        filteredQuestions = filteredQuestions.filter(q => {
            // Проверяем значение is_solved как булево или строку
            const questionSolved = q.is_solved === true || q.is_solved === 'true';
            return isSolved ? questionSolved : !questionSolved;
        });
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
        
        // Проверяем, выбран ли вопрос в режиме редактирования
        const isSelected = selectedQuestions.includes(question.id);
        const selectedClass = isSelected ? 'selected' : '';
        
        html += `
            <div class="question-item ${selectedClass}" data-id="${question.id}" onclick="${isEditMode ? 'toggleQuestionSelection' : 'navigateToQuestion'}(${question.id}, event)">
                <div class="d-flex justify-content-between align-items-start">
                    ${isEditMode ? `<div class="select-checkbox"><i class="fas ${isSelected ? 'fa-check-square' : 'fa-square'}"></i></div>` : ''}
                    <h4>Вопрос №${question.question_number}</h4>
                    ${!isEditMode && isSolved ? '<span class="solved-indicator"><i class="fas fa-check-circle"></i></span>' : ''}
                </div>
                <p>${truncateText(question.question_text, 150)}</p>
                <div class="meta">
                    <span><i class="far fa-calendar-alt me-1"></i> ${formattedDate}</span>
                </div>
            </div>
        `;
    });
    
    questionsListElement.innerHTML = html;
}

// Функция для переключения режима редактирования
function toggleEditMode() {
    isEditMode = !isEditMode;
    selectedQuestions = [];
    
    // Обновляем UI
    const editModeBtn = document.getElementById('editModeBtn');
    const editModePanel = document.getElementById('editModePanel');
    
    if (isEditMode) {
        editModeBtn.classList.add('active');
        editModePanel.style.display = 'block';
    } else {
        editModeBtn.classList.remove('active');
        editModePanel.style.display = 'none';
    }
    
    // Обновляем отображение вопросов
    applyFiltersAndSort();
    
    // Обновляем счетчик выбранных вопросов
    updateSelectedCount();
}

// Функция для отмены режима редактирования
function cancelEditMode() {
    isEditMode = false;
    selectedQuestions = [];
    
    // Обновляем UI
    const editModeBtn = document.getElementById('editModeBtn');
    const editModePanel = document.getElementById('editModePanel');
    
    editModeBtn.classList.remove('active');
    editModePanel.style.display = 'none';
    
    // Обновляем отображение вопросов
    applyFiltersAndSort();
}

// Функция для переключения выбора вопроса
function toggleQuestionSelection(questionId, event) {
    event.stopPropagation();
    
    const index = selectedQuestions.indexOf(questionId);
    if (index === -1) {
        selectedQuestions.push(questionId);
    } else {
        selectedQuestions.splice(index, 1);
    }
    
    // Обновляем UI
    const questionItem = event.currentTarget;
    questionItem.classList.toggle('selected');
    
    // Обновляем иконку чекбокса
    const checkbox = questionItem.querySelector('.select-checkbox i');
    if (checkbox) {
        checkbox.className = selectedQuestions.includes(questionId) ? 'fas fa-check-square' : 'fas fa-square';
    }
    
    // Обновляем счетчик выбранных вопросов
    updateSelectedCount();
}

// Функция для обновления счетчика выбранных вопросов
function updateSelectedCount() {
    const selectedCountElement = document.getElementById('selectedCount');
    if (selectedCountElement) {
        selectedCountElement.textContent = selectedQuestions.length;
    }
}

// Функция для удаления выбранных вопросов
async function deleteSelectedQuestions() {
    if(!checkAuth()) return;
    
    if (selectedQuestions.length === 0) {
        alert('Пожалуйста, выберите хотя бы один вопрос для удаления');
        return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить ${selectedQuestions.length} вопрос(ов)?`)) {
        return;
    }
    
    try {
        for (const questionId of selectedQuestions) {
            await fetchApi(`/api/questions/${questionId}`, {
                method: 'DELETE'
            });
        }
        
        cancelEditMode();
        loadQuestions();
        
        alert('Выбранные вопросы успешно удалены');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при удалении вопросов. Пожалуйста, попробуйте позже.');
    }
}

// Функция для перехода на страницу вопроса
async function navigateToQuestion(questionId, event) {
    if(!checkAuth()) return;
    
    if (event) {
        event.stopPropagation();
    }
    
    if (isEditMode) {
        toggleQuestionSelection(questionId, event);
        return;
    }

    try {
        const question = await fetchApi(`/api/questions/${questionId}`);
        localStorage.setItem('currentQuestion', JSON.stringify(question));
        window.location.href = `/question.html?id=${question.id}`;
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.');
    }
}

// Функция для обрезки текста
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + '...';
}

function showAddQuestionModal() {
    const modal = new bootstrap.Modal(document.getElementById('addQuestionModal'));
    modal.show();
}

// Функция для добавления нового вопроса
async function addQuestion() {
    if(!checkAuth()) return;

    const questionText = document.getElementById('questionText').value.trim();
    
    if (!questionText) {
        alert('Пожалуйста, введите текст вопроса');
        return;
    }
    
    try {
        await fetchApi('/api/questions', {
            method: 'POST',
            body: JSON.stringify({ text: questionText })
        });
        
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