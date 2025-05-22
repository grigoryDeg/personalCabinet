from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
import uvicorn
from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session, engine
from sqlalchemy.orm import sessionmaker
from together import Together
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from models import User, UserLogin
from auth import get_current_user, create_access_token
from models import Question, Answer, UserQuestionHistory
from models import Base
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, func, delete
from chat import router as chat_router

# Настройки базы данных
DATABASE_URL = "postgresql+asyncpg://admin:admin@postgres:5432/personal_cabinet"

# Настройки JWT
SECRET_KEY = "your-secret-key"  # В реальном приложении использовать безопасный ключ
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Настройки SSL
ssl_keyfile = "/etc/ssl/nginx.key"
ssl_certfile = "/etc/ssl/nginx.crt"

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
        
        await session.commit()

@app.post("/api/login")
async def login(user_data: UserLogin):
    try:
        
        async with async_session() as session:
            query = select(User).where(User.user_name == user_data.username)
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Неверные учетные данные"
                )
            
            if user.user_password != user_data.password:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Неверные учетные данные"
                )
            
            try:
                access_token = create_access_token(data={"sub": user_data.username})
                return {"access_token": access_token, "token_type": "bearer"}
            except Exception as token_error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Ошибка создания токена доступа"
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Внутренняя ошибка сервера"
        )

@app.get("/api/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.user_name,
        "id": current_user.id
    }

# Подключаем основной роутер
app.include_router(router)

# Подключаем роутер чата
app.include_router(chat_router, prefix="/api")

# Добавляем тестовый эндпоинт для проверки работоспособности
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

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
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при получении количества вопросов"
            )
            
@app.get("/api/questions/{question_id}")
async def get_question_by_id(question_id: int, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем вопрос по ID и его порядковый номер
            question_query = text(
                "WITH question_data AS ("
                "SELECT q.*, "
                "ROW_NUMBER() OVER (ORDER BY q.id ASC) as question_number "
                "FROM questions q"
                ") "
                "SELECT * FROM question_data WHERE id = :question_id"
            )
            question_result = await session.execute(question_query, {"question_id": question_id})
            question_row = question_result.fetchone()
            
            if not question_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Получаем следующий вопрос по ID
            next_question_query = select(Question).where(Question.id > question_id).order_by(Question.id.asc()).limit(1)
            next_question_result = await session.execute(next_question_query)
            next_question = next_question_result.scalar_one_or_none()
            
            # Если следующего вопроса нет, возвращаем первый вопрос
            if not next_question:
                first_question_query = select(Question).order_by(Question.id.asc()).limit(1)
                first_question_result = await session.execute(first_question_query)
                next_question = first_question_result.scalar_one_or_none()
            
            # Проверяем, есть ли вопрос в истории пользователя
            history_query = select(UserQuestionHistory).where(
                UserQuestionHistory.user_id == current_user.id,
                UserQuestionHistory.question_id == question_row.id
            )
            history_result = await session.execute(history_query)
            history_entry = history_result.scalar_one_or_none()
            
            return {
                "id": question_row.id,
                "question_text": question_row.question_text,
                "is_there_media": question_row.is_there_media,
                "media_url": question_row.media_url if question_row.is_there_media else None,
                "is_solved": history_entry is not None,
                "next_question_id": next_question.id if next_question else None,
                "question_number": question_row.question_number
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении вопроса: {str(e)}"
            )

@app.get("/api/questions/byNumber/{question_number}")
async def get_question_by_number(question_number: int, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем общее количество вопросов
            count_query = select(func.count()).select_from(Question)
            count_result = await session.execute(count_query)
            total_count = count_result.scalar()

            # Вычисляем номер следующего вопроса с учетом цикличности
            next_number = 1 if question_number >= total_count else question_number + 1

            # Получаем текущий вопрос
            current_question_query = text(
                "WITH question_data AS ("
                "SELECT q.*, "
                "ROW_NUMBER() OVER (ORDER BY q.id ASC) as question_number "
                "FROM questions q"
                ") "
                "SELECT * FROM question_data WHERE question_number = :question_number"
            )
            current_question_result = await session.execute(current_question_query, {"question_number": question_number})
            current_question = current_question_result.fetchone()
            
            if not current_question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Проверяем, есть ли вопрос в истории пользователя
            history_query = select(UserQuestionHistory).where(
                UserQuestionHistory.user_id == current_user.id,
                UserQuestionHistory.question_id == current_question.id
            )
            history_result = await session.execute(history_query)
            history_entry = history_result.scalar_one_or_none()
            
            return {
                "id": current_question.id,
                "question_text": current_question.question_text,
                "is_there_media": current_question.is_there_media,
                "media_url": current_question.media_url if current_question.is_there_media else None,
                "is_solved": history_entry is not None,
                "question_number": current_question.question_number,
                "next_question_number": next_number
            }
            
        except Exception as e:
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
            
            # Модифицируем SQL-запрос для правильной нумерации
            sql = text(
                "SELECT q.id, q.question_text, q.created_at, COUNT(a.id) as answers_count, "
                "CASE WHEN qa.question_id IS NOT NULL THEN 'true' ELSE 'false' END as is_solved, "
                "ROW_NUMBER() OVER (ORDER BY q.id ASC) as question_number "  # Изменяем порядок для ROW_NUMBER
                "FROM questions q "
                "LEFT JOIN answers a ON q.id = a.question_id "
                "LEFT JOIN user_question_history qa ON q.id = qa.question_id AND qa.user_id = :user_id "
                "GROUP BY q.id, q.question_text, q.created_at, qa.question_id "
                "ORDER BY q.created_at DESC"  # Оставляем сортировку по дате для отображения
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
                    "is_solved": row.is_solved,
                    "question_number": row.question_number  # Добавляем порядковый номер
                })
            
            return questions_list
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")

@app.post("/api/rememberQuestion")
async def remember_question(question_data: dict, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем вопрос по его номеру
            question_query = text(
                "WITH question_data AS ("
                "SELECT q.*, "
                "ROW_NUMBER() OVER (ORDER BY q.id ASC) as question_number "
                "FROM questions q"
                ") "
                "SELECT * FROM question_data WHERE question_number = :question_number"
            )
            question_result = await session.execute(question_query, {"question_number": question_data["question_number"]})
            question = question_result.fetchone()
            
            if not question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Создаем запись в истории просмотров
            history_entry = UserQuestionHistory(
                user_id=current_user.id,
                question_id=question.id
            )
            
            session.add(history_entry)
            await session.commit()
            
            return {"status": "Запись о просмотре успешно создана"}
            
        except IntegrityError:
            # Если запись уже существует, просто возвращаем успех
            return {"status": "Запись уже существует"}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Ошибка при сохранении истории"
            )

@app.get("/api/answers/byNumber/{question_number}")
async def get_answer_by_question_number(question_number: int, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Получаем вопрос по его номеру
            question_query = text(
                "WITH question_data AS ("
                "SELECT q.*, "
                "ROW_NUMBER() OVER (ORDER BY q.id ASC) as question_number "
                "FROM questions q"
                ") "
                "SELECT * FROM question_data WHERE question_number = :question_number"
            )
            question_result = await session.execute(question_query, {"question_number": question_number})
            question = question_result.fetchone()
            
            if not question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Получаем ответ по ID вопроса
            answer_query = select(Answer).where(Answer.question_id == question.id)
            answer_result = await session.execute(answer_query)
            answer = answer_result.scalar_one_or_none()
            
            if not answer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Для данного вопроса пока нет ответа"
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
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении ответа: {str(e)}"
            )

@app.delete("/api/questions/{question_id}")
async def delete_question(question_id: int, current_user: User = Depends(get_current_user)):
    async with async_session() as session:
        try:
            # Проверяем существование вопроса
            question = await session.get(Question, question_id)
            if not question:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вопрос не найден"
                )
            
            # Удаляем связанные записи в истории пользователей
            history_delete_query = delete(UserQuestionHistory).where(
                UserQuestionHistory.question_id == question_id
            )
            await session.execute(history_delete_query)
            
            # Удаляем связанные ответы
            answers_delete_query = delete(Answer).where(
                Answer.question_id == question_id
            )
            await session.execute(answers_delete_query)
            
            # Удаляем сам вопрос
            await session.delete(question)
            await session.commit()
            
            return {"status": "success", "message": "Вопрос успешно удален"}
            
        except Exception as e:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при удалении вопроса: {str(e)}"
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
