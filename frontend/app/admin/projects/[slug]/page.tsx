// fe/browse — 관리자 프로젝트 인덱스와 아키텍처 SVG 업로드.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DiagramUploader from "@/components/DiagramUploader";
import ProjectView from "@/components/ProjectView";
import { ADMIN_TOKEN_KEY, adminGetProject } from "@/lib/adminClient";
import type { ProjectIndex } from "@/lib/types";

export default function AdminProjectPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [project, setProject] = useState<ProjectIndex | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const savedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!savedToken) {
      router.replace("/admin");
      return () => {
        active = false;
      };
    }
    setToken(savedToken);

    void adminGetProject(savedToken, params.slug).then((result) => {
      if (!active) return;
      if (!result.ok && (result.status === 403 || result.status === 404)) {
        router.replace("/admin");
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setProject(result.data);
    });

    return () => {
      active = false;
    };
  }, [params.slug, router]);

  if (error) {
    return (
      <main className="page reveal">
        <div className="topbar">
          <Link className="back" href="/admin">
            ← 대시보드
          </Link>
          <span>관리자</span>
        </div>
        <p className="admin-error">{error}</p>
      </main>
    );
  }

  if (!project || !token) {
    return (
      <main className="page reveal">
        <div className="empty-state">프로젝트를 불러오는 중…</div>
      </main>
    );
  }

  return (
    <ProjectView
      project={project}
      admin
      controls={
        <DiagramUploader token={token} slug={project.slug} onUploaded={setProject} />
      }
    />
  );
}
