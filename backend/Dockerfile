FROM python:3.9

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app /app

# Создаем директорию для SSL сертификатов
RUN mkdir -p /etc/ssl

# Не копируем сертификаты здесь, они будут монтироваться через volume

CMD ["python", "main.py"]