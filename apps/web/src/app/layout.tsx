/**
 * 루트 레이아웃
 * MUI 테마 및 글로벌 스타일 설정
 */

import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import ThemeRegistry from '@/components/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: '카페매니저 - 네이버 카페 자동 포스팅',
  description: '네이버 카페 자동 포스팅 & 게시글 관리 솔루션',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

