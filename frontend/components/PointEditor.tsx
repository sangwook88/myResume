"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import { adminGetPointRaw, adminSavePoint } from "@/lib/adminClient";
import type { Point } from "@/lib/types";

interface PointEditorProps {
  token: string;
  id: string;
  onSaved: (point: Point) => void;
  onCancel: () => void;
}

export default function PointEditor({ token, id, onSaved, onCancel }: PointEditorProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void adminGetPointRaw(token, id).then((result) => {
      if (!active) return;
      if (result.ok) {
        setContent(result.data.content);
      } else {
        setError(result.message);
        setAuthFailed(result.status === 403 || result.status === 404);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id, token]);

  const save = async () => {
    if (saving) return;
    if (!content.trim()) {
      setError("빈 마크다운은 저장할 수 없습니다.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await adminSavePoint(token, id, content);
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      setAuthFailed(result.status === 403 || result.status === 404);
      return;
    }
    onSaved(result.data);
  };

  if (loading) return <div className="empty-state">원문 마크다운을 불러오는 중…</div>;

  return (
    <section className="card" aria-label="포인트 마크다운 편집기">
      <div className="admin-toolbar">
        <div className="section-label">원문 마크다운 편집</div>
        <div className="admin-actions">
          <button className="back" type="button" onClick={onCancel} disabled={saving}>
            취소
          </button>
          <button className="back" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <label className="sub" htmlFor={`point-editor-${id}`}>
        frontmatter를 포함한 파일 전체를 편집합니다.
      </label>
      <textarea
        id={`point-editor-${id}`}
        className="admin-input"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={saving || authFailed}
        spellCheck={false}
        rows={28}
        style={{ width: "100%", minWidth: 0, marginTop: 10, resize: "vertical" }}
      />

      {error && (
        <div className="admin-error" role="alert">
          {error}
          {authFailed && (
            <>
              {" "}
              <Link href="/admin">관리자 토큰 다시 입력</Link>
            </>
          )}
        </div>
      )}

      {!authFailed && content && (
        <div className="admin-preview">
          <div className="section-label">미리보기</div>
          <Markdown>{content}</Markdown>
        </div>
      )}
    </section>
  );
}
