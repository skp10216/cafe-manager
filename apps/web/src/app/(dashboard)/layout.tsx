'use client';

/**
 * 대시보드 레이아웃
 * 인증된 사용자만 접근 가능한 영역
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import AppLayout from '@/components/layout/AppLayout';
import { authApi, clearAuthToken } from '@/lib/api-client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ 토큰 존재 여부만 보지 말고 실제로 인증이 유효한지 확인한다.
    // - accessToken 만료 시: api-client가 refresh 후 재시도
    // - refresh도 실패 시: 토큰 정리 후 로그인으로 이동
    const run = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        await authApi.me();
        setIsLoading(false);
      } catch {
        clearAuthToken();
        router.push('/login');
      }
    };

    run();
  }, [router]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
