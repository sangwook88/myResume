// fe/browse — 관리자 포인트 편집. 인증·데이터 갱신은 페이지가 맡고,
// 보기 표현은 PointView, 원문 편집은 PointEditor를 재사용한다.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PointEditor from "@/components/PointEditor";
import PointView from "@/components/PointView";
import {
  ADMIN_TOKEN_KEY,
  adminGetPoint,
  adminListPoints,
} from "@/lib/adminClient";
import type { Point, PointSummary } from "@/lib/types";

type AdminViewPoint = Point & { status?: string };

export default function AdminPointPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [point, setPoint] = useState<AdminViewPoint | null>(null);
  const [siblings, setSiblings] = useState<PointSummary[]>([]);
  const [editing, setEditing] = useState(false);
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

    void Promise.all([adminGetPoint(savedToken, params.id), adminListPoints(savedToken)]).then(
      ([detail, all]) => {
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
        setPoint({ ...detail.data, status: summary?.status ?? "draft" });
        setSiblings(
          all.data.filter(
            (candidate) =>
              candidate.project === detail.data.project && candidate.id !== detail.data.id,
          ),
        );
      },
    );

    return () => {
      active = false;
    };
  }, [params.id, router]);

  const saved = async (updatedPoint: Point) => {
    const all = await adminListPoints(token);
    const summary = all.ok
      ? all.data.find((candidate) => candidate.id === updatedPoint.id)
      : undefined;
    setPoint({ ...updatedPoint, status: summary?.status ?? point?.status ?? "draft" });
    if (all.ok) {
      setSiblings(
        all.data.filter(
          (candidate) =>
            candidate.project === updatedPoint.project && candidate.id !== updatedPoint.id,
        ),
      );
    }
    setEditing(false);
  };

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

  if (!point || !token) {
    return (
      <main className="page reveal">
        <div className="empty-state">포인트를 불러오는 중…</div>
      </main>
    );
  }

  if (editing) {
    return (
      <main className="page reveal">
        <div className="topbar">
          <Link className="back" href="/admin">
            ← 대시보드
          </Link>
          <span>{point.title}</span>
        </div>
        <PointEditor
          token={token}
          id={point.id}
          onSaved={(updatedPoint) => void saved(updatedPoint)}
          onCancel={() => setEditing(false)}
        />
      </main>
    );
  }

  return (
    <PointView
      point={point}
      siblings={siblings}
      admin
      controls={
        <button className="back" type="button" onClick={() => setEditing(true)}>
          편집
        </button>
      }
    />
  );
}
