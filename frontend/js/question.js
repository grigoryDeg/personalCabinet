// Функция для получения случайного вопроса, который пользователь еще не видел
async function loadUnknownQuestion() {
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

        const response = await fetch('/api/unknownQuestion', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки вопроса');
        }
        
        const question = await response.json();
        
        // Проверяем, есть ли у вопроса флаг all_questions_seen
        /*
        if (question.all_questions_seen) {
            // Создаем модальное окно
            const modalHtml = `
                <div class="modal fade" id="congratsModal" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Поздравляем!</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p>Молодец, ты решил все задачи!</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Закрыть</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            
            // Добавляем модальное окно в DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Показываем модальное окно
            const modal = new bootstrap.Modal(document.getElementById('congratsModal'));
            modal.show();
            
            // Удаляем модальное окно после закрытия
            document.getElementById('congratsModal').addEventListener('hidden.bs.modal', function () {
                this.remove();
            });
        } */
        
            // Обновляем содержимое карточки
        document.querySelector('h2').textContent = `Вопрос №${question.id}`;
        document.querySelector('.question-text p').textContent = question.question_text;
        document.querySelector('#userAnswer').value = ''; // Очищаем поле ввода
        
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

// Загружаем вопрос при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadUnknownQuestion();
});