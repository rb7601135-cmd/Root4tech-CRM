FROM python:3.12-slim

# Prevent Python from writing .pyc files & buffer stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy project code and make entrypoint executable
COPY . /app/
RUN chmod +x /app/entrypoint.sh

# Create non-root user and set permissions
RUN useradd -m -u 1000 appuser && \
    mkdir -p /app/staticfiles /app/media /app/backups && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Health check using the clean /api/health/ endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8000}/api/health/ || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
