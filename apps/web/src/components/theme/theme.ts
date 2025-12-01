'use client';

/**
 * 카페매니저 MUI 테마 정의
 * Design Spec 기반 커스텀 테마
 */

import { createTheme } from '@mui/material/styles';

// 폰트 설정 (Pretendard 우선)
const fontFamily = [
  '-apple-system',
  'BlinkMacSystemFont',
  'Pretendard',
  'Noto Sans KR',
  'system-ui',
  'sans-serif',
].join(',');

export const theme = createTheme({
  // 컬러 팔레트
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB', // 차분한 블루
      light: '#3B82F6',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#64748B', // 슬레이트
      light: '#94A3B8',
      dark: '#475569',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#DC2626',
      light: '#EF4444',
      dark: '#B91C1C',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
      dark: '#D97706',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    background: {
      default: '#F8FAFC', // 연한 그레이 배경
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    divider: '#E2E8F0',
  },

  // 타이포그래피
  typography: {
    fontFamily,
    h1: {
      fontSize: '1.5rem', // 24px
      fontWeight: 700,
      lineHeight: 1.4,
    },
    h2: {
      fontSize: '1.25rem', // 20px
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h3: {
      fontSize: '1.125rem', // 18px
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1rem', // 16px
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '0.9375rem', // 15px
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem', // 14px
      lineHeight: 1.6,
    },
    caption: {
      fontSize: '0.8125rem', // 13px
      lineHeight: 1.5,
      color: '#64748B',
    },
    button: {
      textTransform: 'none', // 버튼 대문자 변환 비활성화
      fontWeight: 500,
    },
  },

  // 컴포넌트 커스터마이징
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#F8FAFC',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 500,
        },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          },
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          border: '1px solid #E2E8F0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #E2E8F0',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#1E293B',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },

  // 기타 설정
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
});

