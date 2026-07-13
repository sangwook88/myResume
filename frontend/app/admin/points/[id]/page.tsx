// fe/browse — 관리자 포인트 상세. 토큰 조회만 이 페이지가 맡고 표현은 PointView를 재사용한다.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PointView from "@/components/PointView";
import {
  ADMIN_TOKEN_KEY,
  adminGetPoint,
  adminListPoints,
} from "@/lib/adminClient";
import type { Point, PointSummary } from "@/lib/types";

export default function AdminPointPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [point, setPoint] = useState<Point | null>(null);
  const [siblings, setSiblings] = useState<PointSummary[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("draft");
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

    void Promise.all([
      adminGetPoint(token, params.id),
      adminListPoints(token),
    ]).then(([detail, all]) => {
      if (!active) return;
      const authOrMissing =
        (!detail.ok && (detail.status === 403 || detail.status === 404)) ||
        (!all.ok && (all.status === 403 || all.status === 404));
      if (authOrMissing) {
        router.replace("/admin");
        return;
      }
      if (!detail.ok) {
        setError(detail.message);
        return;
      }
      if (!all.ok) {
        setError(all.message);
        return;
      }

      const summary = all.data.find((candidate) => candidate.id === detail.data.id);
      setPoint(detail.data);
      setStatus(summary?.status === "published" ? "published" : "draft");
      setSiblings(
        all.data.filter(
          (candidate) =>
            candidate.project === detail.data.project && candidate.id !== detail.data.id,
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [params.id, router]);

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

  if (!point) {
    return (
      <main className="page reveal">
        <div className="empty-state">포인트를 불러오는 중…</div>
      </main>
    );
  }

  return <PointView point={point} siblings={siblings} admin status={status} />;
}
