#!/bin/bash

# Очистка логов
truncate -s 0 ./logs/backend/app.log 2>/dev/null || true
truncate -s 0 ./logs/frontend/access.log 2>/dev/null || true
truncate -s 0 ./logs/frontend/error.log 2>/dev/null || true
truncate -s 0 ./logs/redis/redis.log 2>/dev/null || true

docker-compose down
docker-compose up --build