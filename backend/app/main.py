from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import uvicorn
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from together import Together
import logging
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from models import User, UserLogin
from auth import get_current_user, create_access_token  # Добавляем импорт create_access_token
from models import Question, Answer, UserQuestionHistory  # Изменяем импорт здесь
from models import Base
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

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

# Удаляем подключение к Redis
# redis_client = redis.Redis(host='redis', port=6379, db=0)

# Подключение к базе данных
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)

# Настройка OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Функция для инициализации тестовых пользователей
async def init_test_users():
    default_users = [
        {"username": "grigory", "password": "mypass1"},
        {"username": "user1", "password": "password11"},
        {"username": "user2", "password": "password22"}
    ]
    
    async with async_session() as session:
        for user_data in default_users:
            # Проверяем существование пользователя
            query = select(User).where(User.user_name == user_data["username"])
            result = await session.execute(query)
            existing_user = result.scalar_one_or_none()
            
            if not existing_user:
                new_user = User(
                    user_name=user_data["username"],
                    user_password=user_data["password"]  # В реальном приложении нужно хешировать
                )
                session.add(new_user)
                logger.info(f"Создан тестовый пользователь: {user_data['username']}")
        
        await session.commit()

@app.post("/api/login")
async def login(user_data: UserLogin):
    try:
        logger.info(f"Попытка входа пользователя: {user_data.username}")
        
        async with async_session() as session:
            query = select(User).where(User.user_name == user_data.username)
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            
            if not user:
                logger.warning(f"Неудачная попытка входа: пользователь {user_data.username} не найден")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Неверные учетные данные"
                )
            
            if user.user_password != user_data.password:
                logger.warning(f"Неудачная попытка входа: неверный пароль для пользователя {user_data.username}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Неверные учетные данные"
                )
            
            try:
                access_token = create_access_token(data={"sub": user_data.username})
                logger.info(f"Успешный вход пользователя: {user_data.username}")
                return {"access_token": access_token, "token_type": "bearer"}
            except Exception as token_error:
                logger.error(f"Ошибка создания токена: {str(token_error)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Ошибка создания токена доступа"
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Ошибка при входе пользователя {user_data.username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@app.get("/api/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    logger.info(f"Запрос профиля пользователя: {current_user.user_name}")
    return {
        "username": current_user.user_name,
        "id": current_user.id
    }

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

@app.get("/api/questions")
async def get_questions(current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Импортируем text из sqlalchemy
            from sqlalchemy import text
            
            # Используем функцию text() для явного указания текстового SQL
            sql = text(
                "SELECT q.id, q.question_text, q.created_at, COUNT(a.id) as answers_count "
                "FROM questions q "
                "LEFT JOIN answers a ON q.id = a.question_id "
                "GROUP BY q.id, q.question_text, q.created_at "
                "ORDER BY q.created_at DESC"
            )
            
            # Выполняем запрос с явным указанием текстового SQL
            result = await session.execute(sql)
            
            # Получаем все строки результата
            rows = result.all()
            
            # Преобразуем результаты в список словарей
            questions_list = []
            for row in rows:
                questions_list.append({
                    "id": row.id,
                    "question_text": row.question_text,
                    "created_at": row.created_at.isoformat(),
                    "answers_count": row.answers_count
                })
            
            return questions_list
        except Exception as e:
            logger.error(f"Ошибка при получении списка вопросов: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

@app.get("/api/unknownQuestion")
async def get_unknown_question(current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем ID всех вопросов, которые пользователь уже видел
            seen_questions = select(UserQuestionHistory.question_id).where(
                UserQuestionHistory.user_id == current_user.id
            )
            
            # Получаем случайный вопрос, который пользователь еще не видел
            query = select(Question).where(
                ~Question.id.in_(seen_questions)
            ).order_by(func.random()).limit(1)
            
            result = await session.execute(query)
            question = result.scalar_one_or_none()
            
            if question is None:
                # Если все вопросы просмотрены, возвращаем случайный вопрос с флагом
                query = select(Question).order_by(func.random()).limit(1)
                result = await session.execute(query)
                question = result.scalar_one()
                return {
                    "id": question.id,
                    "question_text": question.question_text,
                    "all_questions_seen": True
                }
            
            return {
                "id": question.id,
                "question_text": question.question_text,
                "all_questions_seen": False
            }
            
        except Exception as e:
            logger.error(f"Ошибка при получении случайного вопроса: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при получении вопроса"
            )

@app.post("/api/rememberQuestion")
async def remember_question(
    question_data: dict,
    current_user: User = Depends(get_current_user)
):
    async with async_session() as session:
        try:
            # Проверяем существование вопроса
            question = await session.get(Question, question_data["question_id"])
            if not question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Создаем запись в истории просмотров
            history_entry = UserQuestionHistory(
                user_id=current_user.id,
                question_id=question_data["question_id"]
            )
            
            session.add(history_entry)
            await session.commit()
            
            return {"status": "success"}
            
        except IntegrityError:
            # Если запись уже существует, просто возвращаем успех
            return {"status": "success"}
        except Exception as e:
            logger.error(f"Ошибка при сохранении истории просмотра: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при сохранении истории"
            )

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
