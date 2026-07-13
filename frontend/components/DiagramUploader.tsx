"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { adminUploadDiagram } from "@/lib/adminClient";
import type { ProjectIndex } from "@/lib/types";

const MAX_SVG_BYTES = 2 * 1024 * 1024;

interface DiagramUploaderProps {
  token: string;
  slug: string;
  onUploaded: (project: ProjectIndex) => void;
}

async function validateSvg(file: File): Promise<string | null> {
  const extensionIsSvg = file.name.toLowerCase().endsWith(".svg");
  const mimeIsSvg = file.type === "image/svg+xml";
  if (!extensionIsSvg && !mimeIsSvg) return "SVG 파일만 업로드할 수 있습니다.";
  if (file.size === 0) return "빈 SVG 파일은 업로드할 수 없습니다.";
  if (file.size > MAX_SVG_BYTES) return "SVG 파일은 2MB 이하여야 합니다.";

  try {
    const documentNode = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
    if (
      documentNode.querySelector("parsererror") ||
      documentNode.documentElement.localName.toLowerCase() !== "svg"
    ) {
      return "올바른 SVG 문서가 아닙니다.";
    }
  } catch {
    return "SVG 파일을 읽지 못했습니다.";
  }
  return null;
}

export default function DiagramUploader({ token, slug, onUploaded }: DiagramUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [authFailed, setAuthFailed] = useState(false);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(null);
    setError("");
    setSuccess("");
    setAuthFailed(false);
    if (!selected) return;

    const validationError = await validateSvg(selected);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setFile(selected);
  };

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    setSuccess("");
    const result = await adminUploadDiagram(token, slug, file);
    setUploading(false);

    if (!result.ok) {
      setError(result.message);
      setAuthFailed(result.status === 403 || result.status === 404);
      return;
    }
    setSuccess("아키텍처 도식을 갱신했습니다.");
    setFile(null);
    setInputKey((key) => key + 1);
    const diagram = result.data.architectureDiagram;
    onUploaded({
      ...result.data,
      architectureDiagram: diagram
        ? `${diagram}${diagram.includes("?") ? "&" : "?"}v=${Date.now()}`
        : diagram,
    });
  };

  return (
    <form className="admin-form" onSubmit={(event) => void upload(event)}>
      <label className="sub" htmlFor={`diagram-upload-${slug}`}>
        아키텍처 도식 SVG
      </label>
      <input
        key={inputKey}
        id={`diagram-upload-${slug}`}
        className="admin-input"
        type="file"
        accept=".svg,image/svg+xml"
        onChange={(event) => void selectFile(event)}
        disabled={uploading || authFailed}
      />
      <button className="back" type="submit" disabled={!file || uploading || authFailed}>
        {uploading ? "업로드 중…" : "도식 업로드"}
      </button>
      {error && (
        <span className="admin-error" role="alert">
          {error}
          {authFailed && (
            <>
              {" "}
              <Link href="/admin">관리자 토큰 다시 입력</Link>
            </>
          )}
        </span>
      )}
      {success && (
        <span className="sub" role="status">
          {success}
        </span>
      )}
    </form>
  );
}
