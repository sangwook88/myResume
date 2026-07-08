"""be/chat v3 RAG 인덱스 빌드 스크립트.

published 포인트를 로컬 임베딩(fastembed)해 파일 인덱스(backend/.rag_index/)로 저장한다.
위키(wiki/*.md)가 바뀌면 다시 돌려 인덱스를 재생성하면 된다. DB·서버 프로비저닝 없음.

사용:
  cd backend
  .venv/Scripts/python.exe scripts/build_rag_index.py

환경변수(옵션):
  RAG_MODEL      임베딩 모델명(기본 paraphrase-multilingual-MiniLM-L12-v2)
  RAG_INDEX_DIR  인덱스 저장 위치(기본 backend/.rag_index)
  WIKI_ROOT      색인 대상 위키 루트(기본 리포 루트 wiki/)
"""

from __future__ import annotations

import sys
from pathlib import Path

# backend/ 를 import path 에 올린다(scripts/ 에서 실행해도 app.* 임포트되게).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.chat import retrieval  # noqa: E402


def main() -> int:
    n = retrieval.build_index()
    retrieval.invalidate_cache()
    print(f"RAG 인덱스 빌드 완료: {n} 포인트 색인 → {retrieval._INDEX_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
