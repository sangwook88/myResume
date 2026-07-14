"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import {
  adminGetPointRaw,
  adminSavePoint,
  adminUploadPointImage,
} from "@/lib/adminClient";
import {
  assemble,
  splitFrontmatter,
  splitSections,
  type Block,
  type HeadingKind,
} from "@/lib/pointMarkdown";
import type { Point } from "@/lib/types";

interface PointEditorProps {
  token: string;
  id: string;
  onSaved: (point: Point) => void;
  onCancel: () => void;
}

const GROUPS: { title: string; kinds: HeadingKind[] }[] = [
  { title: "요약", kinds: ["summary"] },
  { title: "핵심", kinds: ["problem", "options", "decision", "result"] },
  { title: "심화", kinds: ["background", "execution", "retrospective"] },
  { title: "기타 (Evidence·원문 보존)", kinds: ["evidence", "other"] },
];

const PHOTO_KINDS = new Set<HeadingKind>([
  "summary",
  "background",
  "problem",
  "decision",
  "execution",
  "result",
  "retrospective",
]);

export default function PointEditor({ token, id, onSaved, onCancel }: PointEditorProps) {
  const [frontmatter, setFrontmatter] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBlocks, setUploadingBlocks] = useState<Set<number>>(new Set());
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setAuthFailed(false);
    setUploadErrors({});
    setUploadingBlocks(new Set());

    void adminGetPointRaw(token, id).then((result) => {
      if (!active) return;
      if (result.ok) {
        const split = splitFrontmatter(result.data.content);
        setFrontmatter(split.frontmatter);
        setBlocks(splitSections(split.body));
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

  const content = useMemo(() => assemble(frontmatter, blocks), [frontmatter, blocks]);
  const busy = saving || uploadingBlocks.size > 0;

  const updateBody = (index: number, body: string) => {
    setBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, body } : block,
      ),
    );
  };

  const uploadImage = async (index: number, file: File) => {
    if (uploadingBlocks.has(index) || saving || authFailed) return;

    setUploadingBlocks((current) => new Set(current).add(index));
    setUploadErrors((current) => ({ ...current, [index]: "" }));
    const result = await adminUploadPointImage(token, id, file);

    if (!result.ok) {
      setUploadErrors((current) => ({ ...current, [index]: result.message }));
      setAuthFailed(result.status === 403 || result.status === 404);
    } else {
      setBlocks((current) =>
        current.map((block, blockIndex) =>
          blockIndex === index
            ? { ...block, body: `${block.body}\n\n${result.data.markdown}\n` }
            : block,
        ),
      );
    }

    setUploadingBlocks((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });
  };

  const save = async () => {
    if (busy) return;
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
    <section className="card" aria-label="포인트 섹션 편집기">
      <div className="admin-toolbar">
        <div className="section-label">단락별 편집</div>
        <div className="admin-actions">
          <button className="back" type="button" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button
            className="back"
            type="button"
            onClick={() => void save()}
            disabled={busy || authFailed}
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="admin-grouphead">메타데이터</div>
      <label className="sub" htmlFor={`point-frontmatter-${id}`}>
        id와 project를 바꾸면 서버가 저장을 거부합니다.
      </label>
      <textarea
        id={`point-frontmatter-${id}`}
        className="admin-input"
        value={frontmatter}
        onChange={(event) => setFrontmatter(event.target.value)}
        disabled={busy || authFailed}
        spellCheck={false}
        rows={10}
        style={{ width: "100%", minWidth: 0, marginTop: 10, resize: "vertical" }}
      />

      {GROUPS.map((group) => {
        const groupBlocks = blocks
          .map((block, index) => ({ block, index }))
          .filter(({ block }) => group.kinds.includes(block.headingKind));
        if (groupBlocks.length === 0) return null;

        return (
          <div key={group.title}>
            <div className="admin-grouphead">{group.title}</div>
            {groupBlocks.map(({ block, index }) => (
              <SectionBlockEditor
                key={`${block.heading}-${index}`}
                id={id}
                block={block}
                index={index}
                disabled={saving || authFailed}
                uploading={uploadingBlocks.has(index)}
                uploadError={uploadErrors[index]}
                authFailed={authFailed}
                onChange={(body) => updateBody(index, body)}
                onUpload={(file) => uploadImage(index, file)}
              />
            ))}
          </div>
        );
      })}

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
          <div className="section-label">전체 마크다운 미리보기</div>
          <Markdown>{content}</Markdown>
        </div>
      )}
    </section>
  );
}

function SectionBlockEditor({
  id,
  block,
  index,
  disabled,
  uploading,
  uploadError,
  authFailed,
  onChange,
  onUpload,
}: {
  id: string;
  block: Block;
  index: number;
  disabled: boolean;
  uploading: boolean;
  uploadError?: string;
  authFailed: boolean;
  onChange: (body: string) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const editorId = `point-section-${id}-${index}`;
  const headingLabel = block.heading.replace(/^#{1,6}\s+/, "").trim() || "헤딩 전 본문";
  const canUpload = PHOTO_KINDS.has(block.headingKind);

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        padding: 14,
        marginTop: 10,
      }}
    >
      <div className="admin-toolbar">
        <label htmlFor={editorId}>
          <strong>{headingLabel}</strong>
          <span className="admin-mono" style={{ display: "block", marginTop: 3 }}>
            {block.heading || "(헤딩 없는 리딩 블록)"}
          </span>
        </label>
        {canUpload && (
          <div className="admin-actions">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void onUpload(file);
              }}
            />
            <button
              className="back"
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? "업로드 중…" : "사진 첨부"}
            </button>
          </div>
        )}
      </div>
      <textarea
        id={editorId}
        className="admin-input"
        value={block.body}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || uploading}
        spellCheck={false}
        rows={Math.max(5, Math.min(16, block.body.split("\n").length + 2))}
        style={{ width: "100%", minWidth: 0, marginTop: 10, resize: "vertical" }}
      />
      {uploadError && (
        <div className="admin-error" role="alert">
          {uploadError}
          {authFailed && (
            <>
              {" "}
              <Link href="/admin">관리자 토큰 다시 입력</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
