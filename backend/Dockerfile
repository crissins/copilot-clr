# ============================================================================
# CognitiveClear API — Azure Container Apps
# Python 3.11 slim, uvicorn ASGI server
# Includes system deps for Azure Speech SDK (libssl, libasound)
# ============================================================================

FROM python:3.11-slim

WORKDIR /app

# System dependencies required by azure-cognitiveservices-speech SDK
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libssl-dev \
      libasound2 \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Non-root user for security — never run as root in production
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
