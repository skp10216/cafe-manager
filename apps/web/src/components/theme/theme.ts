'use client';

/**
 * 카페매니저 MUI 테마 정의
 * Linear/Notion 스타일 콘솔 감성 - 프리미엄 타이포그래피
 */

import { createTheme, alpha } from '@mui/material/styles';

// ============================================
// 폰트 설정 (Pretendard Variable 중심)
// ============================================

/** 기본 UI 폰트 - Pretendard Variable (한국어 가독성 최적) */
const fontFamily = [
  '"Pretendard Variable"',
  'Pretendard',
  '-apple-system',
  'BlinkMacSystemFont',
  'system-ui',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(',');

/** 숫자/코드용 모노스페이스 폰트 */
const monoFontFamily = [
  '"JetBrains Mono"',
  '"SF Mono"',
  '"Fira Code"',
  '"Roboto Mono"',
  'Consolas',
  'monospace',
].join(',');

// ============================================
// 테마 생성
// ============================================

export const theme = createTheme({
  // 컬러 팔레트 (Linear/Notion 스타일)
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB',
      light: '#3B82F6',
      dark: '#1D4ED8',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#6B7280',
      light: '#9CA3AF',
      dark: '#4B5563',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
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
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#18181B',    // zinc-900
      secondary: '#71717A',  // zinc-500
      disabled: '#A1A1AA',   // zinc-400
    },
    divider: '#E4E4E7', // zinc-200
  },

  // 타이포그래피 시스템 (3단 계층)
  typography: {
    fontFamily,
    
    // KPI 숫자용 (가장 강조)
    h1: {
      fontFamily,
      fontSize: '2rem',      // 32px
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.025em',
      fontVariantNumeric: 'tabular-nums',
    },
    
    // 대형 숫자/값
    h2: {
      fontFamily,
      fontSize: '1.5rem',    // 24px
      fontWeight: 700,
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
      fontVariantNumeric: 'tabular-nums',
    },
    
    // 섹션 타이틀
    h3: {
      fontFamily,
      fontSize: '1.125rem',  // 18px
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    
    // 카드 타이틀
    h4: {
      fontFamily,
      fontSize: '1rem',      // 16px
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    
    // 서브 타이틀
    h5: {
      fontFamily,
      fontSize: '0.9375rem', // 15px
      fontWeight: 600,
      lineHeight: 1.4,
    },
    
    // 작은 타이틀
    h6: {
      fontFamily,
      fontSize: '0.875rem',  // 14px
      fontWeight: 600,
      lineHeight: 1.4,
    },
    
    // 본문 (기본)
    body1: {
      fontFamily,
      fontSize: '0.9375rem', // 15px
      fontWeight: 400,
      lineHeight: 1.6,
    },
    
    // 본문 (작은)
    body2: {
      fontFamily,
      fontSize: '0.875rem',  // 14px
      fontWeight: 400,
      lineHeight: 1.6,
    },
    
    // 캡션/라벨 (보조)
    caption: {
      fontFamily,
      fontSize: '0.75rem',   // 12px
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
    
    // 오버라인 (작은 라벨)
    overline: {
      fontFamily,
      fontSize: '0.6875rem', // 11px
      fontWeight: 600,
      lineHeight: 1.5,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    
    // 버튼
    button: {
      fontFamily,
      textTransform: 'none',
      fontWeight: 500,
      letterSpacing: '-0.01em',
    },
  },

  // 컴포넌트 커스터마이징
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        body: {
          backgroundColor: '#FAFAFA',
          fontFamily,
        },
        // tabular-nums 전역 적용 (숫자 정렬)
        'input, table, .MuiTypography-root': {
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          h4: 'h4',
          h5: 'h5',
          h6: 'h6',
          body1: 'p',
          body2: 'p',
          caption: 'span',
          overline: 'span',
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
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
          border: '1px solid #E4E4E7',
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
        root: {
          fontVariantNumeric: 'tabular-nums',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#FAFAFA',
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
          borderRight: '1px solid #E4E4E7',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#18181B',
          boxShadow: '0 1px 0 #E4E4E7',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: alpha('#000', 0.06),
        },
        bar: {
          borderRadius: 4,
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

// ============================================
// 타이포그래피 유틸리티 (커스텀 확장)
// ============================================

/** 모노스페이스 폰트 패밀리 export */
export { monoFontFamily };

/** 숫자 전용 스타일 (tabular-nums) */
export const numericStyles = {
  fontFamily: monoFontFamily,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
} as const;

/** KPI 숫자 스타일 */
export const kpiNumberStyles = {
  fontWeight: 700,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum"',
} as const;

/** 라벨 스타일 (보조 텍스트) */
export const labelStyles = {
  fontWeight: 500,
  fontSize: '0.75rem',
  letterSpacing: '0.01em',
  textTransform: 'uppercase' as const,
  color: '#71717A',
} as const;
