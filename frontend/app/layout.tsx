// fe/browse — 공통 레이아웃. 모든 화면 공통 브랜드바 + 전역 챗봇 FAB(상시).
// FAB는 client island(ChatFab)로, 나머지 페이지는 서버 컴포넌트(BE fetch SSG/ISR).
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import ChatFab from '@/components/ChatFab';
import './globals.css';

export const metadata: Metadata = {
  title: '근거기반 포트폴리오',
  description: '결정마다 커밋·PR·Swagger로 검증 가능한 포트폴리오',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="brandbar">
          <Link href="/">근거기반 포트폴리오</Link>
        </header>
        {children}
        {/* 전역 우하단 FAB — 대화 UI는 fe/chat 소관. 맥락(포인트 id)은 URL에서 파생. */}
        <ChatFab />
      </body>
    </html>
  );
}
