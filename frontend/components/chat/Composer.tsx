'use client';

// fe/chat — 입력창 + 제안 질문 칩. 열릴 때 입력창 포커스(접근성).
// 제안 칩은 대화 시작 전(첫 질문 전)에만 노출. 하이브리드 제안값은 ChatPanel이 결정해 주입.
import { useEffect, useRef, useState } from 'react';

export default function Composer({
  suggestions,
  suggestionLabel,
  showSuggestions,
  disabled,
  onSend,
}: {
  suggestions: string[];
  suggestionLabel: string;
  showSuggestions: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 패널이 열릴 때(마운트 시) 입력창으로 포커스 이동.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    onSend(text);
  }

  return (
    <>
      {showSuggestions && suggestions.length > 0 && (
        <div className="chips">
          <div className="chlbl">{suggestionLabel}</div>
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              className="chip"
              disabled={disabled}
              onClick={() => onSend(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="inputbar" onSubmit={submit}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="질문을 입력하세요…"
          autoComplete="off"
          aria-label="질문 입력"
        />
        <button type="submit" title="전송" aria-label="전송" disabled={disabled || value.trim() === ''}>
          ➤
        </button>
      </form>
    </>
  );
}
