"""be/chat 도메인: load-all 답변 생성·근거 인용·세션 이력·맥락 제안질문.

패턴 = TS(트랜잭션 스크립트, ARCHITECTURE §4). LLM·Redis 오케스트레이션이며
도메인 불변식은 없다. 코퍼스는 be/point·be/project를 읽기만 한다(단방향).
"""
