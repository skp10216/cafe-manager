'use client';

/**
 * MUI 테마 레지스트리
 * 커스텀 테마 및 CssBaseline 적용
 */

import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { ToastProvider } from '@/components/common/ToastProvider';

interface ThemeRegistryProps {
  children: React.ReactNode;
}

export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastProvider maxToasts={5}>{children}</ToastProvider>
    </ThemeProvider>
  );
}




