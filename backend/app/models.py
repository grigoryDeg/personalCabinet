from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Question(Base):
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True)
    question_text = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)

class Answer(Base):
    __tablename__ = 'answers'
    
    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, nullable=False)
    answer_text = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)

class User(BaseModel):
    username: str

class UserLogin(BaseModel):
    username: str
    password: str
