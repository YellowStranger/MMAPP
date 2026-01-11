# Используем официальный образ Python
FROM python:3.10-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости (нужны для сборки mysqlclient и других пакетов)
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Копируем файл зависимостей
COPY requirements.txt .

# Устанавливаем Python зависимости
# Добавляем daphne и mysqlclient, если их нет в requirements
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir daphne mysqlclient channels-redis

# Копируем код проекта
COPY . .

# Собираем статику
RUN python manage.py collectstatic --noinput

# Открываем порт 8000
EXPOSE 8000

# Запускаем Daphne
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "chat_project.asgi:application"]
