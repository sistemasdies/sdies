# ============================================================
# SDIES — imagen de producción (web + SPA servida por Django)
# docker build -t sdies .  | Railway detecta este Dockerfile
# ============================================================

# ---- Etapa 1: build del frontend React -----------------------
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY apps/erp_frontend/package.json apps/erp_frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/erp_frontend/ ./
RUN npm run build

# ---- Etapa 2: backend Python ---------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements/base.txt

COPY requirements/production.txt requirements/production.txt
RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .
COPY --from=frontend /frontend/build apps/erp_frontend/build

RUN mkdir -p /app/media /app/staticfiles

EXPOSE 8000
CMD ["sh", "-c", \
     "python manage.py migrate --noinput && \
      python manage.py collectstatic --noinput && \
      if [ \"$LOAD_FIXTURE\" = \"true\" ]; then \
        python manage.py cargar_datos --fixture db/fixtures/data.json; \
      fi && \
      gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} \
      --workers 3 --timeout 300 --access-logfile -"]