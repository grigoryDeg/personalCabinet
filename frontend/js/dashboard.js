// Функция для проверки авторизации и обновления контента страницы dashboard.html
document.addEventListener('DOMContentLoaded', async function() {
    if(!checkAuth()) return;

    try {
        // Получаем статистику по вопросам используя универсальную функцию fetchApi
        const stats = await fetchApi('/api/questions/count');
        
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

    // Отображаем имя пользователя в поле ЛК
    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('username').textContent = username;
    }
});