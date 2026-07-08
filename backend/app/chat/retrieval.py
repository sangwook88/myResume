"""be/chat v3 RAG 검색: 로컬 임베딩 + 파일 기반 벡터 인덱스(시맨틱 top-K).

배포 모델 = 각자 레포 포크해 셀프호스팅(DB 프로비저닝 0). 그래서:
- 관계형 DB·벡터 DB 서버를 쓰지 않는다. 인덱스 = numpy 배열 + 메타 JSON 을 파일에 저장.
- 외부 임베딩 API 를 쓰지 않는다. 로컬 ONNX 임베딩(fastembed, torch 불필요)만 쓴다.
- 코퍼스가 작으므로(포인트 수십 개) 질의 시 전량 코사인 유사도 top-K 면 충분하다
  (전용 ANN 인덱스 불필요).

임베딩 단위 = published 포인트 1건(제목·요약·9섹션 본문을 한 문서로 합쳐 임베딩).
인용 계약(evidence·point_of_token)이 포인트 단위이므로 검색도 포인트 단위로 맞춘다
— top-K 로 고른 포인트를 corpus._render_point 로 통째 렌더하면 토큰 매핑이 그대로 보존된다.

fastembed·numpy 는 지연 임포트한다(미설치 환경에서도 앱 임포트는 성공 → corpus 가
load-all 로 폴백). 즉 RAG 는 "있으면 쓰고 없으면 load-all" 로 안전하게 퇴화한다.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

from app.point import service as point_service
from app.project import service as project_service

logger = logging.getLogger(__name__)

# 다국어(한국어 포함) 경량 임베딩 모델. 384차원, torch 불필요(ONNX).
# e5 계열과 달리 query/passage 프리픽스가 필요 없어 사용이 단순하다.
MODEL_NAME = os.environ.get(
    "RAG_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

# retrieval.py = backend/app/chat/retrieval.py → parents[2] = backend/
_INDEX_DIR = Path(
    os.environ.get("RAG_INDEX_DIR", str(Path(__file__).resolve().parents[2] / ".rag_index"))
)
_VECTORS_PATH = _INDEX_DIR / "vectors.npy"
_META_PATH = _INDEX_DIR / "meta.json"


@dataclass
class RetrievedPoint:
    """검색 결과 1건: 포인트 식별자 + 관련도 점수(코사인 유사도)."""

    id: str
    title: str
    project: str
    score: float


# ---- 임베딩 문서 조립 ------------------------------------------------------


def _point_document(point) -> str:
    """포인트를 임베딩용 평문 문서로 직렬화(제목·요약·텍스트 섹션·옵션).

    Evidence(링크)는 의미 검색에 노이즈이므로 임베딩 문서에서 제외한다
    (인용은 렌더 단계에서 point_of_token 으로 따로 매핑됨)."""
    sec = point.sections
    parts = [point.title, point.summary or ""]
    for body in (
        sec.background,
        sec.problem,
        sec.decision,
        sec.execution,
        sec.result,
        sec.retrospective,
    ):
        if body:
            parts.append(body)
    if sec.options:
        for o in sec.options:
            parts.append(
                " ".join(x for x in (o.option, o.pros, o.cons, o.cost, o.adopted) if x)
            )
    return "\n".join(p for p in parts if p)


def iter_published_points():
    """색인 대상 = 모든 프로젝트의 published 포인트 전문(공개 계약만 사용)."""
    seen: set[str] = set()
    for proj in project_service.list_projects():
        for summ in point_service.list_by_project(proj.slug):
            if summ.id in seen:
                continue
            point = point_service.get_published(summ.id)
            if point is None:
                continue
            seen.add(point.id)
            yield point


def _corpus_fingerprint(docs: list[tuple[str, str]]) -> str:
    """색인 대상(id + 문서 본문)의 해시 — 위키가 바뀌면 값이 달라져 stale 감지에 쓴다."""
    h = hashlib.sha256()
    h.update(MODEL_NAME.encode("utf-8"))
    for pid, doc in docs:
        h.update(pid.encode("utf-8"))
        h.update(b"\x00")
        h.update(doc.encode("utf-8"))
        h.update(b"\x01")
    return h.hexdigest()


# ---- 인덱스 빌드/로드 ------------------------------------------------------


def _embed(texts: list[str]):
    """텍스트 리스트 → L2 정규화된 numpy 벡터 행렬(코사인=내적)."""
    import numpy as np  # noqa: PLC0415 (지연 임포트)
    from fastembed import TextEmbedding  # noqa: PLC0415

    model = TextEmbedding(model_name=MODEL_NAME)
    vecs = np.array(list(model.embed(texts)), dtype="float32")
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vecs / norms


def build_index() -> int:
    """published 포인트를 임베딩해 파일 인덱스(vectors.npy + meta.json)로 저장.

    반환 = 색인된 포인트 수. 위키가 바뀔 때마다 재빌드하면 된다
    (scripts/build_rag_index.py 또는 이 함수 직접 호출).
    """
    import numpy as np  # noqa: PLC0415

    points = list(iter_published_points())
    docs = [(p.id, _point_document(p)) for p in points]

    _INDEX_DIR.mkdir(parents=True, exist_ok=True)
    if not docs:
        # 빈 코퍼스: 인덱스도 비운다(retrieve 는 [] 반환 → 서비스가 거부 카피).
        np.save(_VECTORS_PATH, np.zeros((0, 0), dtype="float32"))
        _META_PATH.write_text(
            json.dumps(
                {"model": MODEL_NAME, "fingerprint": _corpus_fingerprint([]), "points": []},
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        logger.info("RAG 인덱스 빌드: published 포인트 0개 — 빈 인덱스 저장")
        return 0

    vectors = _embed([d for _, d in docs])
    meta = {
        "model": MODEL_NAME,
        "fingerprint": _corpus_fingerprint(docs),
        "points": [{"id": p.id, "title": p.title, "project": p.project} for p in points],
    }
    np.save(_VECTORS_PATH, vectors)
    _META_PATH.write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    logger.info("RAG 인덱스 빌드 완료: %d 포인트 → %s", len(points), _INDEX_DIR)
    return len(points)


# 로드된 인덱스를 프로세스 내 캐시(벡터, 메타). 최초 질의 때 1회 로드.
_cache: dict | None = None


def _load_index() -> dict | None:
    """파일 인덱스를 로드해 캐시. 없으면 None(호출측이 load-all 로 폴백)."""
    global _cache
    if _cache is not None:
        return _cache
    if not _VECTORS_PATH.exists() or not _META_PATH.exists():
        return None
    try:
        import numpy as np  # noqa: PLC0415

        vectors = np.load(_VECTORS_PATH)
        meta = json.loads(_META_PATH.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 — 손상된 인덱스는 없는 것으로 간주(폴백)
        logger.exception("RAG 인덱스 로드 실패 — load-all 로 폴백")
        return None
    _cache = {"vectors": vectors, "meta": meta}
    return _cache


def invalidate_cache() -> None:
    """재빌드 후 프로세스 내 캐시를 비운다(테스트·핫리로드용)."""
    global _cache
    _cache = None


def index_exists() -> bool:
    """파일 인덱스가 존재하는가(서비스가 RAG 경로 진입 여부 판단에 사용)."""
    return _VECTORS_PATH.exists() and _META_PATH.exists()


def indexed_count() -> int:
    """인덱스에 색인된 포인트 수(코퍼스 크기 → load-all vs RAG 전환 판단)."""
    idx = _load_index()
    if idx is None:
        return 0
    return len(idx["meta"].get("points") or [])


# ---- 질의 -----------------------------------------------------------------


def retrieve(question: str, k: int = 6) -> list[RetrievedPoint]:
    """질문과 관련 높은 published 포인트 top-K(코사인 유사도 내림차순).

    인덱스가 없거나 비었으면 빈 리스트를 반환한다(호출측은 load-all 로 폴백하거나
    빈 근거로 처리). fastembed 미설치 시에도 예외 없이 [] 를 돌려 안전 퇴화한다.
    """
    idx = _load_index()
    if idx is None:
        return []
    meta_points = idx["meta"].get("points") or []
    vectors = idx["vectors"]
    if not meta_points or getattr(vectors, "size", 0) == 0:
        return []

    try:
        import numpy as np  # noqa: PLC0415

        qv = _embed([question])[0]
        scores = vectors @ qv  # 둘 다 L2 정규화 → 내적 = 코사인 유사도
        order = np.argsort(-scores)[:k]
    except Exception:  # noqa: BLE001 — 임베딩/질의 실패는 폴백 신호
        logger.exception("RAG 질의 실패 — load-all 로 폴백")
        return []

    results: list[RetrievedPoint] = []
    for i in order:
        p = meta_points[int(i)]
        results.append(
            RetrievedPoint(
                id=p["id"], title=p["title"], project=p["project"], score=float(scores[int(i)])
            )
        )
    return results
