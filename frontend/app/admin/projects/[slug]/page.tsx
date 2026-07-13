// fe/browse — 관리자 프로젝트 인덱스. 토큰 조회만 이 페이지가 맡고 표현은 ProjectView를 재사용한다.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ProjectView from "@/components/ProjectView";
import {
  ADMIN_TOKEN_KEY,
  adminGetProject,
} from "@/lib/adminClient";
import type { ProjectIndex } from "@/lib/types";

export default function AdminProjectPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectIndex | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      router.replace("/admin");
      return () => {
        active = false;
      };
    }

    void adminGetProject(token, params.slug).then((result) => {
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
          <Link className="back" href="/admin">← 대시보드</Link>
          <span>관리자</span>
        </div>
        <p className="admin-error">{error}</p>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="page reveal">
        <div className="empty-state">프로젝트를 불러오는 중…</div>
      </main>
    );
  }

  return <ProjectView project={project} admin />;
}
