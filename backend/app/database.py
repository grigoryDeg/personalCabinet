from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Настройки базы данных
DATABASE_URL = "postgresql+asyncpg://admin:admin@postgres:5432/personal_cabinet"

# Подключение к базе данных
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)