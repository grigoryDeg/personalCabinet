// Функция для проверки авторизации
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Пожалуйста, войдите в систему');
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Универсальная функция для работы с API
async function fetchApi(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // Объединяем дефолтные заголовки с переданными опциями
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка API:', error);
        throw error;
    }
}