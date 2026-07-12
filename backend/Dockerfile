# 근거기반 포트폴리오 BE — FastAPI(uvicorn). 콘텐츠(wiki)는 이미지에 굽지 않고
# compose 에서 read-only 볼륨으로 마운트한다(WIKI_ROOT=/app/wiki) → 포폴 갱신 = git pull 만.
# RAG(requirements-rag.txt)는 기본 제외 — CHAT_RAG_ENABLED 를 켤 때만 별도 이미지에서 설치.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    WIKI_ROOT=/app/wiki

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
