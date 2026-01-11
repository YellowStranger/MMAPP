# Инструкция по развертыванию MMAPP

У вас есть два варианта развертывания:
1.  **Быстрый (Docker)** — рекомендуемый вариант "в один клик".
2.  **Ручной (Ubuntu + Nginx + MySQL)** — классический вариант.

---

## Вариант 1: Быстрый запуск (Docker)

Это самый простой способ. Вам понадобится только установленный **Docker** и **Docker Compose**.

### 1. Установите Docker (если не установлен)
```bash
# Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install docker-compose -y
```

### 2. Запуск проекта
Находясь в папке с проектом (где лежит `docker-compose.yml`), выполните одну команду:

```bash
sudo docker-compose up -d --build
```
*Флаг `-d` запускает контейнеры в фоновом режиме.*

### 3. Применение миграций
После первого запуска нужно создать таблицы в базе данных:

```bash
sudo docker-compose exec web python manage.py migrate
```

**Готово!** Проект доступен по адресу `http://localhost:8000` (или IP вашего сервера).

---

## Вариант 2: Ручная установка (Ubuntu + MySQL)

### Шаг 1: Подготовка сервера

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv python3-dev default-libmysqlclient-dev build-essential mysql-server nginx curl git redis-server -y
```

### Шаг 2: Настройка MySQL

1. Зайдите в MySQL:
```bash
sudo mysql
```

2. Создайте базу и пользователя:
```sql
CREATE DATABASE mmapp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mmapp_user'@'localhost' IDENTIFIED BY 'ващ_надёжный_пароль';
GRANT ALL PRIVILEGES ON mmapp_db.* TO 'mmapp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Шаг 3: Настройка проекта

1. Клонируйте проект в `/var/www/MMAPP`.
2. Создайте виртуальное окружение и установите зависимости:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn daphne mysqlclient channels-redis
```

### Шаг 4: Настройка Django (settings.py)

В файле `chat_project/settings.py` укажите настройки для MySQL:

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'mmapp_db',
        'USER': 'mmapp_user',
        'PASSWORD': 'ващ_надёжный_пароль',
        'HOST': 'localhost',
        'PORT': '3306',
    }
}
```

Не забудьте применить миграции:
```bash
python manage.py migrate
python manage.py collectstatic
```

### Шаг 5: Настройка службы Daphne

Создайте файл `/etc/systemd/system/mmapp.service`:

```ini
[Unit]
Description=Daphne service for MMAPP
After=network.target mysql.service redis-server.service

[Service]
User=root
Group=www-data
WorkingDirectory=/var/www/MMAPP
ExecStart=/var/www/MMAPP/venv/bin/daphne -b 0.0.0.0 -p 8000 chat_project.asgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

Запустите:
```bash
sudo systemctl start mmapp
sudo systemctl enable mmapp
```

### Шаг 6: Настройка Nginx

Создайте конфиг `/etc/nginx/sites-available/mmapp`:

```nginx
upstream channels-backend {
    server localhost:8000;
}

server {
    listen 80;
    server_name your_domain.com;

    location /static/ {
        root /var/www/MMAPP;
    }

    location / {
        proxy_pass http://channels-backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Активируйте:
```bash
sudo ln -s /etc/nginx/sites-available/mmapp /etc/nginx/sites-enabled
sudo systemctl restart nginx
```
