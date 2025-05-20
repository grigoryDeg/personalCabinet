from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from datetime import datetime
from models import User, Conversation, Message
from auth import get_current_user
from database import async_session
from together import Together
import os

router = APIRouter()

@router.post("/chat")
async def chat(message: dict, current_user: User = Depends(get_current_user)):
    """
    Простой чат без сохранения истории
    """
    try:
        api_key = os.getenv("TOGETHER_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="API ключ Together не настроен"
            )
        client = Together(api_key=api_key)
        
        response = client.chat.completions.create(
            model="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            messages=[{"role": "user", "content": message["message"]}]
        )
        
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/history")
async def get_chat_history(current_user: User = Depends(get_current_user)):
    """
    Получение истории сообщений для текущего пользователя
    """
    async with async_session() as session:
        try:
            # Находим активную беседу пользователя
            query = select(Conversation).where(
                Conversation.user_id == current_user.id,
                Conversation.is_active == True
            )
            result = await session.execute(query)
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                return []
            
            # Получаем все сообщения из этой беседы
            messages_query = select(Message).where(
                Message.conversation_id == conversation.id
            ).order_by(Message.created_at.asc())
            
            messages_result = await session.execute(messages_query)
            messages = messages_result.scalars().all()
            
            return [
                {
                    "content": msg.content,
                    "is_from_user": msg.is_from_user,
                    "created_at": msg.created_at.isoformat()
                }
                for msg in messages
            ]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при получении истории сообщений: {str(e)}"
            )

@router.post("/chat/message")
async def send_message(message: dict, current_user: User = Depends(get_current_user)):
    """
    Отправка сообщения и получение ответа от бота
    """
    async with async_session() as session:
        try:
            if "content" not in message or not message["content"].strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Текст сообщения не может быть пустым"
                )

            # Находим или создаем активную беседу
            query = select(Conversation).where(
                Conversation.user_id == current_user.id,
                Conversation.is_active == True
            )
            result = await session.execute(query)
            conversation = result.scalar_one_or_none()

            if not conversation:
                conversation = Conversation(
                    user_id=current_user.id,
                    created_at=datetime.now(),
                    last_message_at=datetime.now(),
                    is_active=True
                )
                session.add(conversation)
                await session.commit()
                await session.refresh(conversation)

            # Сохраняем сообщение пользователя
            user_message = Message(
                conversation_id=conversation.id,
                content=message["content"],
                is_from_user=True,
                created_at=datetime.now()
            )
            session.add(user_message)

            # Получаем ответ от бота
            api_key = os.getenv("TOGETHER_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=500,
                    detail="API ключ Together не настроен"
                )
            
            client = Together(api_key=api_key)
            response = client.chat.completions.create(
                model="meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
                messages=[{"role": "user", "content": message["content"]}]
            )

            # Сохраняем ответ бота
            bot_message = Message(
                conversation_id=conversation.id,
                content=response.choices[0].message.content,
                is_from_user=False,
                created_at=datetime.now()
            )
            session.add(bot_message)

            # Обновляем время последнего сообщения в беседе
            conversation.last_message_at = datetime.now()
            
            await session.commit()

            return {
                "message": bot_message.content,
                "created_at": bot_message.created_at.isoformat()
            }

        except HTTPException as he:
            raise he
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка при обработке сообщения: {str(e)}"
            )