from minio import Minio
import os

# Конфигурация Minio
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio")
MINIO_PORT = os.getenv("MINIO_PORT", "9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "images")

# Создаем клиент Minio
minio_client = Minio(
    f"{MINIO_ENDPOINT}:{MINIO_PORT}",
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=False  # Используем HTTP вместо HTTPS для локальной разработки
)

# Функция для инициализации бакета при запуске
async def init_minio():
    try:
        # Проверяем существование бакета
        if not minio_client.bucket_exists(MINIO_BUCKET):
            # Создаем бакет, если он не существует
            minio_client.make_bucket(MINIO_BUCKET)
    except Exception as e:
        print(f"Ошибка при инициализации Minio: {str(e)}")