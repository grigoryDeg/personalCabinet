// Функция для получения следующего вопроса
async function loadNextQuestion() {
    if(!checkAuth()) return;
    
    try {
        // Получаем текущий номер вопроса из URL
        const urlParams = new URLSearchParams(window.location.search);
        const currentNumber = parseInt(urlParams.get('number')) || 1;
        
        // Сначала получаем общее количество вопросов
        const countResponse = await fetchApi('/api/questions/count');
        const totalCount = countResponse.count;
        
        // Вычисляем номер следующего вопроса с учетом цикличности
        const nextNumber = currentNumber >= totalCount ? 1 : currentNumber + 1;
        
        // Загружаем следующий вопрос по вычисленному номеру
        const question = await fetchApi(`/api/questions/byNumber/${nextNumber}`);
        
        if (!question) {
            throw new Error('Следующий вопрос не найден');
        }
        
        // Обновляем UI с анимацией
        const questionCard = document.querySelector('.question-card');
        questionCard.classList.add('fade-out');
        
        // Ждем завершения анимации исчезновения
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Обновляем содержимое
        displayQuestion(question);
        
        // Убираем класс перевернутой карточки, если он был
        questionCard.classList.remove('flipped');
        
        // Небольшая задержка перед анимацией появления
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Добавляем класс для анимации появления
        questionCard.classList.remove('fade-out');
        questionCard.classList.add('fade-in');
        
        // Обновляем URL, используя номер следующего вопроса
        window.history.pushState({}, '', `/question.html?number=${nextNumber}`);
        
        // Убираем класс fade-in после завершения анимации
        setTimeout(() => {
            questionCard.classList.remove('fade-in');
        }, 300);
        
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
    }
}

// Функция для отображения вопроса
function displayQuestion(question) {
    const questionCard = document.querySelector('.question-card');
    const solvedBadge = document.getElementById('solvedBadge');

    // Обновляем заголовок, используя question_number вместо id
    document.querySelector('h2').textContent = `Вопрос №${question.question_number}`;
    
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

// Функция для загрузки конкретного вопроса по ID
async function loadQuestionById(questionId) {
    if(!checkAuth()) return;
    
    try {
        const question = await fetchApi(`/api/questions/${questionId}`);
        displayQuestion(question);
    } catch (error) {
        console.error('Ошибка:', error);
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
    }
}

async function loadQuestionByNumber(questionNumber) {
    if(!checkAuth()) return;
    
    try {
        const question = await fetchApi(`/api/questions/byNumber/${questionNumber}`);
        displayQuestion(question);
        
        // Обновляем URL после успешной загрузки
        window.history.pushState({}, '', `/question.html?number=${question.question_number}`);
    } catch (error) {
        console.error('Ошибка:', error);
        if (error.message.includes('404')) {
            // Создаем модальное окно для 404 ошибки
            const modalHtml = `
                <div class="modal" id="questionNotFoundModal" tabindex="-1" role="dialog">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content" role="document">
                            <div class="modal-header">
                                <h5 class="modal-title" id="questionNotFoundModalLabel">Вопрос не найден</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть" title="Закрыть"></button>
                            </div>
                            <div class="modal-body">
                                <p>Запрашиваемый вопрос не найден в базе данных.</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" aria-label="Закрыть окно">Закрыть</button>
                                <button type="button" class="btn btn-primary" onclick="loadQuestionByNumber(1)">Перейти к первому вопросу</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            
            // Добавляем модальное окно в DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Показываем модальное окно
            const modal = new bootstrap.Modal(document.getElementById('questionNotFoundModal'));
            modal.show();
            
            // Удаляем модальное окно после закрытия
            document.getElementById('questionNotFoundModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });
            return;
        }
        document.querySelector('.question-text p').textContent = 'Произошла ошибка при загрузке вопроса. Пожалуйста, попробуйте позже.';
    }
}

// Изменяем обработчик загрузки страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Получаем номер вопроса из URL
    const urlParams = new URLSearchParams(window.location.search);
    const questionNumber = urlParams.get('number');
    
    if (questionNumber) {
        // Если есть номер в URL, загружаем вопрос по номеру
        await loadQuestionByNumber(questionNumber);
    } else {
        // Если нет номера, пробуем загрузить из localStorage
        const savedQuestion = localStorage.getItem('currentQuestion');
        if (savedQuestion) {
            try {
                const question = JSON.parse(savedQuestion);
                displayQuestion(question);
                // Обновляем URL после отображения
                window.history.pushState({}, '', `/question.html?number=${question.question_number}`);
            } catch (error) {
                // Если возникла ошибка при парсинге, загружаем первый вопрос
                loadQuestionByNumber(1);
            }
        } else {
            // Если нет данных в localStorage, загружаем первый вопрос
            loadQuestionByNumber(1);
        }
    }
    
    // Очищаем localStorage после использования
    localStorage.removeItem('currentQuestion');
});

async function submitAnswer() {
    const userAnswer = document.getElementById('userAnswer').value;
    if (!userAnswer.trim()) {
        alert('Пожалуйста, введите ваш ответ');
        return;
    }
    
    try {
        // Получаем номер текущего вопроса из URL
        const urlParams = new URLSearchParams(window.location.search);
        const questionNumber = urlParams.get('number');
        
        // Получаем правильный ответ для текущего вопроса по его номеру
        const answerData = await fetchApi(`/api/answers/byNumber/${questionNumber}`);
        
        // Отображаем ответ пользователя
        document.getElementById('userAnswerDisplay').textContent = userAnswer;
        
        // Отображаем правильный ответ
        document.getElementById('correctAnswer').textContent = answerData.answer_text;

        // Если есть медиа-контент в ответе, отображаем его
        if (answerData.is_there_media && answerData.media_url) {
            const answerMediaContainer = document.createElement('div');
            answerMediaContainer.className = 'answer-media-container mt-3';
            const mediaElement = document.createElement('img');
            mediaElement.src = answerData.media_url;
            mediaElement.alt = 'Изображение к ответу';
            mediaElement.className = 'answer-media';
            answerMediaContainer.appendChild(mediaElement);
            document.querySelector('.correct-answer').appendChild(answerMediaContainer);
        }
        
        // Переворачиваем карточку
        document.querySelector('.question-card').classList.add('flipped');
            
        // Проверяем состояние AI-кнопки
        const aiCheckBtn = document.querySelector('.ai-check-btn');
        if (aiCheckBtn.classList.contains('active')) {
            document.querySelector('.question-card').classList.add('flipped');
            await evaluateAnswer();
            return;
        }
    } catch (error) {
        if (error.message.includes('404')) {
            // Получаем детали ошибки из объекта error
            let errorMessage = 'Ответ для данного вопроса не найден';
            
            try {
                // Проверяем наличие JSON в сообщении об ошибке
                const errorText = error.message.split('404 ')[1];
                if (errorText) {
                    const errorDetail = JSON.parse(errorText);
                    errorMessage = errorDetail.detail.message || errorDetail.detail || errorMessage;
                }
            } catch (e) {
                console.error('Ошибка при парсинге деталей ошибки:', e);
            }
            
            // Создаем модальное окно для 404 ошибки
            const modalHtml = `
                <div class="modal" id="noAnswerModal" tabindex="-1" role="dialog">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content" role="document">
                            <div class="modal-header">
                                <h5 class="modal-title" id="noAnswerModalLabel">Ответ недоступен</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть" title="Закрыть"></button>
                            </div>
                            <div class="modal-body">
                                <p>${errorMessage}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" aria-label="Закрыть окно">Закрыть</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            
            // Добавляем модальное окно в DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Показываем модальное окно
            const modal = new bootstrap.Modal(document.getElementById('noAnswerModal'));
            modal.show();
            
            // Удаляем модальное окно после закрытия
            document.getElementById('noAnswerModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });
            return;
        }
        console.error('Ошибка:', error);
        alert('Произошла ошибка при проверке ответа. Пожалуйста, попробуйте позже.');
    }
}

function flipCard() {
    document.querySelector('.question-card').classList.toggle('flipped');
}

function toggleAiCheck(button) {
    button.classList.toggle('active');
    if (button.classList.contains('active')) {
        button.style.backgroundColor = '#764ba2'; // Фиолетовый цвет
        button.style.color = '#fff'; // Белый цвет текста
    } else {
        button.style.backgroundColor = '#ccc'; // Серый цвет
        button.style.color = '#764ba2'; // Цвет текста
    }
}