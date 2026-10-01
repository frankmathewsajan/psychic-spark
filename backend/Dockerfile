# Use official slim Python runtime
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered streaming logs for Cloud Run
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# Install system dependencies (curl for health checks, libpq for PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Ensure storage directories exist inside the container
RUN mkdir -p /app/storage/audit_images

# Cloud Run listens on PORT (defaults to 8080)
EXPOSE 8080

# Cloud Run injects $PORT at runtime; exec uvicorn with shell expansion
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
