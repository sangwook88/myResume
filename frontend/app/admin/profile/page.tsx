"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProfileEditor from "@/components/ProfileEditor";
import { ADMIN_TOKEN_KEY } from "@/lib/adminClient";

export default function AdminProfilePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!savedToken) {
      router.replace("/admin");
      return;
    }
    setToken(savedToken);
  }, [router]);

  if (!token) {
    return (
      <main className="page reveal">
        <div className="empty-state">관리자 인증을 확인하는 중…</div>
      </main>
    );
  }

  return (
    <main className="page reveal">
      <div className="topbar">
        <Link className="back" href="/admin">
          ← 대시보드
        </Link>
        <span>관리자</span>
      </div>
      <h1>프로필 편집</h1>
      <p className="sub">랜딩 최상단에 보이는 사진·연락처·자기소개를 관리합니다.</p>
      {saved && (
        <p className="admin-success" role="status">
          프로필을 저장했습니다. 랜딩의 캐시가 갱신되면 변경 내용이 반영됩니다.
        </p>
      )}
      <ProfileEditor
        token={token}
        onSaved={() => setSaved(true)}
        onCancel={() => router.push("/admin")}
      />
    </main>
  );
}
