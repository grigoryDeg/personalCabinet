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
async def create_question(question: dict, current_user: User = Depends(get_current_user)):
    try:
        if "text" not in question or not question["text"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Текст вопроса обязателен"
            )
            
        async with async_session() as session:
            # Получаем максимальный ID из существующих вопросов
            max_id_query = select(func.max(Question.id))
            max_id_result = await session.execute(max_id_query)
            max_id = max_id_result.scalar() or 0
            
            # Создаем новый вопрос с ID на единицу больше максимального
            new_question = Question(
                id=max_id + 1,
                question_text=question["text"],
                user_id=current_user.id,
                created_at=datetime.now(),
                is_there_media=False,
                media_url=None
            )
            session.add(new_question)
            try:
                await session.commit()
                await session.refresh(new_question)
            except IntegrityError as ie:
                await session.rollback()
                logger.error(f"Ошибка целостности данных при создании вопроса: {str(ie)}")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Конфликт при создании вопроса. Пожалуйста, попробуйте еще раз."
                )
            
            return {
                "status": "success",
                "question_id": new_question.id,
                "question_text": new_question.question_text
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Ошибка при создании вопроса: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при создании вопроса"
        )

@app.get("/api/questions/count")
async def get_questions_count(current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем общее количество вопросов
            count_query = select(func.count()).select_from(Question)
            result = await session.execute(count_query)
            total_count = result.scalar()
            
            # Получаем количество решенных вопросов для текущего пользователя
            solved_query = select(func.count()).select_from(UserQuestionHistory).where(
                UserQuestionHistory.user_id == current_user.id
            )
            solved_result = await session.execute(solved_query)
            solved_count = solved_result.scalar()
            
            return {
                "count": total_count,
                "solved_count": solved_count
            }
            
        except Exception as e:
            logger.error(f"Ошибка при получении количества вопросов: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при получении количества вопросов"
            )
            
@app.get("/api/questions/{question_id}")
async def get_question_by_id(question_id: int, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем вопрос по ID
            question_query = select(Question).where(Question.id == question_id)
            question_result = await session.execute(question_query)
            question = question_result.scalar_one_or_none()
            
            if not question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Проверяем, есть ли вопрос в истории пользователя
            history_query = select(UserQuestionHistory).where(
                UserQuestionHistory.user_id == current_user.id,
                UserQuestionHistory.question_id == question.id
            )
            history_result = await session.execute(history_query)
            history_entry = history_result.scalar_one_or_none()
            
            # Получаем следующий вопрос по ID
            next_question_query = select(Question).where(Question.id > question.id).order_by(Question.id.asc()).limit(1)
            next_question_result = await session.execute(next_question_query)
            next_question = next_question_result.scalar_one_or_none()
            
            # Если следующего вопроса нет, возвращаем первый вопрос
            if not next_question:
                first_question_query = select(Question).order_by(Question.id.asc()).limit(1)
                first_question_result = await session.execute(first_question_query)
                next_question = first_question_result.scalar_one_or_none()
            
            return {
                "id": question.id,
                "question_text": question.question_text,
                "is_there_media": question.is_there_media,
                "media_url": question.media_url if question.is_there_media else None,
                "is_solved": history_entry is not None,
                "next_question_id": next_question.id if next_question else None
            }
            
        except Exception as e:
            logger.error(f"Ошибка при получении вопроса по ID: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении вопроса: {str(e)}"
            )

@app.get("/api/questions")
async def get_questions(current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Импортируем text из sqlalchemy
            from sqlalchemy import text
            
            # Используем функцию text() для явного указания текстового SQL
            sql = text(
                "SELECT q.id, q.question_text, q.created_at, COUNT(a.id) as answers_count, "
                "CASE WHEN qa.question_id IS NOT NULL THEN 'true' ELSE 'false' END as is_solved "
                "FROM questions q "
                "LEFT JOIN answers a ON q.id = a.question_id "
                "LEFT JOIN user_question_history qa ON q.id = qa.question_id AND qa.user_id = :user_id "
                "GROUP BY q.id, q.question_text, q.created_at, qa.question_id "
                "ORDER BY q.created_at DESC"
            )
            
            # Выполняем запрос с передачей параметра user_id
            result = await session.execute(sql, {"user_id": current_user.id})
            
            # Получаем все строки результата
            rows = result.all()
            
            # Преобразуем результаты в список словарей
            questions_list = []
            for row in rows:
                questions_list.append({
                    "id": row.id,
                    "question_text": row.question_text,
                    "created_at": row.created_at.isoformat(),
                    "answers_count": row.answers_count,
                    "is_solved": row.is_solved
                })
            
            return questions_list
        except Exception as e:
            logger.error(f"Ошибка при получении списка вопросов: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

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

@app.get("/api/answers/{answer_id}")
async def get_answer_by_id(answer_id: int, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем ответ по ID вопроса (не ответа)
            answer_query = select(Answer).where(Answer.question_id == answer_id)
            answer_result = await session.execute(answer_query)
            answer = answer_result.scalar_one_or_none()
            
            if not answer:
                # Проверяем существование самого вопроса
                question_query = select(Question).where(Question.id == answer_id)
                question_result = await session.execute(question_query)
                question = question_result.scalar_one_or_none()
                
                if not question:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Вопрос не найден"
                    )
                    
                # Если вопрос существует, но ответа нет
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Для данного вопроса пока нет ответа"
                )
            
            # Проверяем, имеет ли пользователь доступ к этому ответу
            question_query = select(Question).where(Question.id == answer.question_id)
            question_result = await session.execute(question_query)
            question = question_result.scalar_one_or_none()
            
            if not question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Связанный вопрос не найден"
                )
            
            return {
                "id": answer.id,
                "answer_text": answer.answer_text,
                "is_there_media": answer.is_there_media,
                "media_url": answer.media_url if answer.is_there_media else None,
                "created_at": answer.created_at.isoformat(),
                "question_id": answer.question_id,
                "user_id": answer.user_id
            }
            
        except HTTPException as he:
            raise he
        except Exception as e:
            logger.error(f"Ошибка при получении ответа по ID: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении ответа: {str(e)}"
            )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile=ssl_keyfile,
        ssl_certfile=ssl_certfile,
        reload=True
    )
