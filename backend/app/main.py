from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import uvicorn
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from together import Together
import redis
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from models import User, UserLogin
from auth import get_current_user
from models import Question, Answer
from models import Base

# Настройка логирования
logging.basicConfig(
    filename='/var/log/backend/app.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Настройки базы данных
DATABASE_URL = "postgresql+asyncpg://admin:admin@postgres:5432/personal_cabinet"

# Настройки JWT
SECRET_KEY = "your-secret-key"  # В реальном приложении использовать безопасный ключ
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

app = FastAPI()
router = APIRouter()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение к Redis
redis_client = redis.Redis(host='redis', port=6379, db=0)

# Подключение к базе данных
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)

# Настройка OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Функция для инициализации тестовых пользователей
def init_test_users():
    default_users = [
        {"username": "grigory", "password": "mypass1"},
        {"username": "user1", "password": "password11"},
        {"username": "user2", "password": "password22"}
    ]
    
    for user in default_users:
        user_key = f"user:{user['username']}"
        if not redis_client.exists(user_key):
            redis_client.set(user_key, json.dumps(user))
            logger.info(f"Создан тестовый пользователь: {user['username']}")
            
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверные учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        logger.error(f"Ошибка при проверке JWT токена")
        raise credentials_exception
    
    logger.info(f"Успешная аутентификация пользователя: {username}")
    user = User(username=username)
    return user

#Инициализируем тестовых пользователей при запуске приложения
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Инициализация тестовых пользователей")
    init_test_users()
    logger.info("Инициализация завершена")

@app.post("/api/login")
async def login(user_data: UserLogin):
    logger.info(f"Попытка входа пользователя: {user_data.username}")
    # Получаем данные пользователя из Redis
    stored_user = redis_client.get(f"user:{user_data.username}")
    if not stored_user:
        logger.warning(f"Неудачная попытка входа: пользователь {user_data.username} не найден")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные"
        )
    
    # Преобразуем bytes в словарь
    user_info = json.loads(stored_user)
    
    # Проверяем пароль (в реальном приложении нужно использовать хеширование)
    if user_info.get('password') != user_data.password:
        logger.warning(f"Неудачная попытка входа: неверный пароль для пользователя {user_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные"
        )
    
    # Создаем токен доступа
    access_token = create_access_token(data={"sub": user_data.username})
    logger.info(f"Успешный вход пользователя: {user_data.username}")
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    logger.info(f"Запрос профиля пользователя: {current_user.username}")
    # Получаем дополнительные данные пользователя из Redis
    user_data = redis_client.get(f"user:{current_user.username}")
    if user_data:
        user_info = json.loads(user_data)
        # Удаляем пароль из данных перед отправкой клиенту
        user_info.pop('password', None)
        return user_info
    return current_user

# Добавляем эндпоинт для API Together
@router.post("/api/chat")
async def chat(message: dict, current_user = Depends(get_current_user)):
    try:
        api_key = os.getenv("TOGETHER_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="API ключ Together не настроен"
            )
        client = Together(api_key=api_key)  # Используем переменную окружения TOGETHER_API_KEY
        
        response = client.chat.completions.create(
            model="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            messages=[{"role": "user", "content": message["message"]}]
        )
        
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Подключаем роутер к приложению
app.include_router(router)

# Добавляем тестовый эндпоинт для проверки работоспособности
@app.get("/api/health")
async def health_check():
    logger.info("Проверка работоспособности API")
    return {"status": "ok"}

# Настройки SSL
ssl_keyfile = "/etc/ssl/nginx.key"
ssl_certfile = "/etc/ssl/nginx.crt"

@app.post("/api/questions")
async def create_question(question: dict):
    async with async_session() as session:
        new_question = Question(
            question_text=question["text"],
            created_at=datetime.now()
        )
        session.add(new_question)
        await session.commit()
        return {"status": "success", "question_id": new_question.id}

@app.get("/api/questions/{question_id}")
async def get_question(question_id: int):
    async with async_session() as session:
        question = await session.get(Question, question_id)
        if question is None:
            logger.error(f"Вопрос с id {question_id} не найден")
            raise HTTPException(status_code=404, detail="Вопрос не найден")
        try:
            return {"question": question.question_text}
        except Exception as e:
            logger.error(f"Ошибка при доступе к полю question_text: {e}")
            raise HTTPException(status_code=500, detail="Ошибка сервера")

# Настройки SSL
ssl_keyfile = "/etc/ssl/nginx.key"
ssl_certfile = "/etc/ssl/nginx.crt"

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        reload=True
    )
