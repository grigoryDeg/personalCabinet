// Функция для получения следующего вопроса
async function loadNextQuestion() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }
    
    try {
        // Отключаем взаимодействие на время анимации
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

        const response = await fetch('/api/question', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки вопроса');
        }
        
        const question = await response.json();
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
        
        // Сохраняем вопрос в истории просмотров
        await rememberQuestion(question.id);
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
        // Восстанавливаем взаимодействие в случае ошибки
        const questionCard = document.querySelector('.question-card');
        if (questionCard) {
            questionCard.style.pointerEvents = 'auto';
        }
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
        
        // Сохраняем вопрос в истории просмотров
        await rememberQuestion(question.id);
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
    }
}

// Загружаем вопрос при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const savedQuestion = localStorage.getItem('currentQuestion');
    if (savedQuestion) {
        const question = JSON.parse(savedQuestion);
        displayQuestion(question);
        // Очищаем сохраненный вопрос после отображения
        localStorage.removeItem('currentQuestion');
    } else {
        loadNextQuestion();
    }

    // Загружаем имя пользователя
    loadUsername();
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