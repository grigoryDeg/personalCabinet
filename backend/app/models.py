from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Question(Base):
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True)
    question_text = Column(Text, nullable=False)
    is_there_media = Column(Boolean, default=False)
    media_url = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'))
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    __table_args__ = (
        Index('idx_question_user', user_id),
    )

class Answer(Base):
    __tablename__ = 'answers'
    
    id = Column(Integer, primary_key=True)
    answer_text = Column(Text, nullable=False)
    is_there_media = Column(Boolean, default=False)
    media_url = Column(String, nullable=True)
    question_id = Column(Integer, ForeignKey('questions.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'))
    created_at = Column(DateTime, nullable=False, default=datetime.now)

    __table_args__ = (
        Index('idx_answer_question', question_id),
        Index('idx_answer_user', user_id),
    )

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    user_name = Column(String, unique=True, nullable=False)
    user_password = Column(String, nullable=False)

class UserQuestionHistory(Base):
    __tablename__ = 'user_question_history'
    
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    question_id = Column(Integer, ForeignKey('questions.id', ondelete='CASCADE'), primary_key=True)

    __table_args__ = (
        Index('idx_history_user', user_id),
        Index('idx_history_question', question_id),
    )

# Pydantic модели для API
class UserLogin(BaseModel):
    username: str
    password: str
