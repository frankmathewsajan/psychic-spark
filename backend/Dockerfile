# Use official slim Python runtime
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/storage/audit_images

EXPOSE 8000

# Single worker command for Render 512MB RAM safety
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
