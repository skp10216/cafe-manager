'use client';

/**
 * Admin 앱 루트 레이아웃
 */

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { Noto_Sans_KR } from 'next/font/google';

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Admin 전용 다크 테마
const adminTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#60A5FA',  // 블루
      light: '#93C5FD',
      dark: '#3B82F6',
    },
    secondary: {
      main: '#A78BFA',  // 퍼플
    },
    background: {
      default: '#0F172A',  // 슬레이트 900
      paper: '#1E293B',    // 슬레이트 800
    },
    error: {
      main: '#F87171',
    },
    warning: {
      main: '#FBBF24',
    },
    success: {
      main: '#34D399',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: '#334155',
  },
  typography: {
    fontFamily: `${notoSansKr.style.fontFamily}, -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif`,
    h1: {
      fontSize: '1.75rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.8125rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <title>카페매니저 Admin</title>
        <meta name="description" content="카페매니저 관리자 콘솔" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={notoSansKr.className}>
        <ThemeProvider theme={adminTheme}>
          <CssBaseline />
          <Box
            sx={{
              minHeight: '100vh',
              bgcolor: 'background.default',
            }}
          >
            {children}
          </Box>
        </ThemeProvider>
      </body>
    </html>
  );
}


