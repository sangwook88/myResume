"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  adminSaveProfile,
  adminUploadProfileImage,
  fetchProfileClient,
  type ProfileEdit,
} from "@/lib/adminClient";
import type { Profile } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
type TextField = Exclude<keyof ProfileEdit, "photo">;

export default function ProfileEditor({
  token,
  onSaved,
  onCancel,
}: {
  token: string;
  onSaved: (profile: Profile) => void;
  onCancel: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState<ProfileEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setUploadError("");
    setAuthFailed(false);

    void fetchProfileClient().then((profile) => {
      if (!active) return;
      setEdit(profile);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [token]);

  const busy = saving || uploading;
  const photo = edit?.photo?.trim();
  const photoSrc = photo?.startsWith("/api/") ? `${API_BASE}${photo}` : photo;

  const setField = (field: TextField, value: string) => {
    setEdit((current) => (current ? { ...current, [field]: value } : current));
  };

  const uploadImage = async (file: File) => {
    if (!edit || busy || authFailed) return;
    setUploading(true);
    setUploadError("");

    const result = await adminUploadProfileImage(token, file);
    setUploading(false);

    if (!result.ok) {
      setUploadError(result.message);
      setAuthFailed(result.status === 403 || result.status === 404);
      return;
    }
    setEdit((current) => (current ? { ...current, photo: result.data.url } : current));
  };

  const save = async () => {
    if (!edit || busy || authFailed) return;
    setSaving(true);
    setError("");

    const result = await adminSaveProfile(token, edit);
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      setAuthFailed(result.status === 403 || result.status === 404);
      return;
    }
    setEdit(result.data);
    onSaved(result.data);
  };

  if (loading || !edit) {
    return <div className="empty-state">프로필을 불러오는 중…</div>;
  }

  return (
    <form
      className="card profile-editor"
      aria-label="프로필 편집기"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="admin-toolbar">
        <div className="section-label">프로필 필드</div>
        <div className="admin-actions">
          <button className="back" type="button" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button className="back" type="submit" disabled={busy || authFailed}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>

      <div className="profile-editor-photo-row">
        <div className="profile-editor-photo">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- BE 또는 외부 URL 프로필 사진 미리보기
            <img src={photoSrc} alt="프로필 사진 미리보기" />
          ) : (
            <span>사진 없음</span>
          )}
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            disabled={busy || authFailed}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadImage(file);
            }}
          />
          <button
            className="back"
            type="button"
            disabled={busy || authFailed}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? "업로드 중…" : "사진 업로드"}
          </button>
          <p className="profile-editor-help">PNG·JPEG·GIF·WebP 파일을 업로드할 수 있습니다.</p>
          {uploadError && (
            <p className="admin-error" role="alert">
              {uploadError}
              {authFailed && (
                <>
                  {" "}
                  <Link href="/admin">관리자 토큰 다시 입력</Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="profile-form-grid">
        <ProfileField label="이름" htmlFor="profile-name">
          <input
            id="profile-name"
            className="admin-input"
            value={edit.name}
            onChange={(event) => setField("name", event.target.value)}
            disabled={busy || authFailed}
          />
        </ProfileField>
        <ProfileField label="Headline" htmlFor="profile-headline">
          <input
            id="profile-headline"
            className="admin-input"
            value={edit.headline}
            onChange={(event) => setField("headline", event.target.value)}
            disabled={busy || authFailed}
          />
        </ProfileField>
        <ProfileField label="GitHub URL" htmlFor="profile-github">
          <input
            id="profile-github"
            className="admin-input"
            type="url"
            value={edit.github}
            onChange={(event) => setField("github", event.target.value)}
            disabled={busy || authFailed}
            placeholder="https://github.com/username"
          />
        </ProfileField>
        <ProfileField label="전화" htmlFor="profile-phone">
          <input
            id="profile-phone"
            className="admin-input"
            type="tel"
            value={edit.phone}
            onChange={(event) => setField("phone", event.target.value)}
            disabled={busy || authFailed}
          />
        </ProfileField>
        <ProfileField label="이메일" htmlFor="profile-email">
          <input
            id="profile-email"
            className="admin-input"
            type="email"
            value={edit.email}
            onChange={(event) => setField("email", event.target.value)}
            disabled={busy || authFailed}
          />
        </ProfileField>
        <ProfileField label="자기소개 (Markdown)" htmlFor="profile-intro" wide>
          <textarea
            id="profile-intro"
            className="admin-input"
            value={edit.intro}
            onChange={(event) => setField("intro", event.target.value)}
            disabled={busy || authFailed}
            rows={7}
          />
        </ProfileField>
      </div>

      {error && (
        <p className="admin-error" role="alert">
          {error}
          {authFailed && (
            <>
              {" "}
              <Link href="/admin">관리자 토큰 다시 입력</Link>
            </>
          )}
        </p>
      )}
    </form>
  );
}

function ProfileField({
  label,
  htmlFor,
  wide = false,
  children,
}: {
  label: string;
  htmlFor: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`profile-editor-field${wide ? " wide" : ""}`} htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}
