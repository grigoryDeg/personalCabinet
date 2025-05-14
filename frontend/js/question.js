// Функция для получения следующего вопроса
async function loadNextQuestion() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    try {
        // Получаем текущий ID вопроса из URL
        const urlParams = new URLSearchParams(window.location.search);
        const currentId = parseInt(urlParams.get('id')) || 1;
        
        // Сначала сохраняем текущий вопрос в истории просмотров
        await rememberQuestion(currentId);
        
        // Получаем общее количество вопросов
        const totalQuestionsResponse = await fetch('/api/questions/count', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!totalQuestionsResponse.ok) {
            throw new Error('Ошибка получения количества вопросов');
        }
        
        const { count } = await totalQuestionsResponse.json();
        
        // Вычисляем ID следующего вопроса с учетом цикличности
        const nextId = currentId >= count ? 1 : currentId + 1;
        
        // Затем загружаем следующий вопрос
        const response = await fetch(`/api/questions/${nextId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки вопроса');
        }
        
        const question = await response.json();
        if (!question) {
            throw new Error('Следующий вопрос не найден');
        }
        
        // Обновляем UI
        const questionCard = document.querySelector('.question-card');
        questionCard.style.pointerEvents = 'none';
        
        // Начальное состояние для анимации исчезновения
        questionCard.style.transform = 'translateX(0)';
        questionCard.style.opacity = '1';
        
        // Анимация исчезновения
        questionCard.style.transform = 'translateX(-100%)';
        questionCard.style.opacity = '0';
        
        // Ждем завершения анимации исчезновения
        await new Promise(resolve => setTimeout(resolve, 500));

        const solvedBadge = document.getElementById('solvedBadge');

        if (question.is_solved) {
            solvedBadge.style.display = 'flex';
        } else {
            solvedBadge.style.display = 'none';
        }

        // Обновляем содержимое карточки
        document.querySelector('h2').textContent = `Вопрос №${question.id}`;
        document.querySelector('.question-text p').textContent = question.question_text;
        document.querySelector('#userAnswer').value = ''; // Очищаем поле ввода

        // Обрабатываем изображение, если оно есть
        const questionImage = document.getElementById('questionImage');
        const imageElement = questionImage.querySelector('img');

        if (question.is_there_media && question.media_url) {
            imageElement.src = question.media_url;
            questionImage.style.display = 'block';
        } else {
            questionImage.style.display = 'none';
            imageElement.src = '';
        }
        
        // Убираем класс fade-out и добавляем fade-in
        questionCard.classList.remove('fade-out');
        
        // Небольшая задержка перед анимацией появления
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Возвращаем карточку в исходное положение
        questionCard.style.transform = 'translateX(0)';
        questionCard.style.opacity = '1';
        questionCard.classList.add('fade-in');
        
        // Восстанавливаем взаимодействие после завершения анимации
        setTimeout(() => {
            questionCard.style.pointerEvents = 'auto';
            questionCard.classList.remove('fade-in');
        }, 500);
        
        // Обновляем URL с правильным ID следующего вопроса
        window.history.pushState({}, '', `/question.html?id=${question.id}`);
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
    }
}

// Функция для сохранения вопроса в истории просмотров
async function rememberQuestion(questionId) {
    const token = localStorage.getItem('token');
    if (!token) {
        return;
    }
    
    try {
        const response = await fetch('/api/rememberQuestion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question_id: questionId })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при сохранении вопроса в истории');
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

// Функция для загрузки конкретного вопроса по ID
async function loadQuestionById(questionId) {
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
        
        const question = await response.json();
        displayQuestion(question);
        
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
    }
}

// Загружаем вопрос при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Получаем ID вопроса из URL
    const urlParams = new URLSearchParams(window.location.search);
    const questionId = urlParams.get('id');
    
    if (questionId) {
        // Если есть ID в URL, загружаем вопрос по ID
        await loadQuestionById(questionId);
    } else {
        // Если нет ID, пробуем загрузить из localStorage
        const savedQuestion = localStorage.getItem('currentQuestion');
        if (savedQuestion) {
            try {
                const question = JSON.parse(savedQuestion);
                displayQuestion(question);
            } catch (error) {
                // Если возникла ошибка при парсинге, загружаем первый вопрос
                loadNextQuestion();
            }
        } else {
            // Если нет данных в localStorage, загружаем первый вопрос
            loadNextQuestion();
        }
    }
    
    // Очищаем localStorage после использования
    localStorage.removeItem('currentQuestion');
});

function displayQuestion(question) {
    const questionCard = document.querySelector('.question-card');
    const solvedBadge = document.getElementById('solvedBadge');

    // Обновляем заголовок
    document.querySelector('h2').textContent = `Вопрос №${question.id}`;
    
    // Обновляем текст вопроса
    document.querySelector('.question-text p').textContent = question.question_text;
    
    // Обновляем статус решения
    if (question.is_solved) {
        solvedBadge.style.display = 'flex';
    } else {
        solvedBadge.style.display = 'none';
    }

    // Обрабатываем изображение, если оно есть
    const questionImage = document.getElementById('questionImage');
    const imageElement = questionImage.querySelector('img');

    if (question.is_there_media && question.media_url) {
        imageElement.src = question.media_url;
        questionImage.style.display = 'block';
    } else {
        questionImage.style.display = 'none';
        imageElement.src = '';
    }

    // Очищаем поле ввода ответа
    document.querySelector('#userAnswer').value = '';
}