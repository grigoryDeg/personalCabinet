async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('https://' + window.location.host + '/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка авторизации');
        }
        
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        
        // Перенаправляем на страницу дашборда
        window.location.href = '/dashboard.html';
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}