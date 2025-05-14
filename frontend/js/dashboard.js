document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем токен
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        // Получаем статистику по вопросам
        const response = await fetch('/api/questions/count', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Ошибка получения статистики');
        }

        const stats = await response.json();
        
        // Обновляем статистику в карточке "Задачи из базы данных"
        const dbTasksStats = document.querySelector('.stat-card:first-child p');
        dbTasksStats.textContent = `Решено ${stats.solved_count}/${stats.count}`;

    } catch (error) {
        console.error('Ошибка:', error);
        // Показываем сообщение об ошибке в интерфейсе
        const dbTasksStats = document.querySelector('.stat-card:first-child p');
        dbTasksStats.textContent = 'Ошибка загрузки статистики';
        dbTasksStats.style.color = '#dc3545';
    }

    // Отображаем имя пользователя
    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('username').textContent = username;
    }
});