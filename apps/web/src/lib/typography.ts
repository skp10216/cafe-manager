/**
 * 공통 타이포그래피 시스템
 * Linear/Notion 스타일 콘솔 감성
 * 
 * 사용법:
 * - KPI 숫자: typography.kpiNumber
 * - 섹션 타이틀: typography.sectionTitle
 * - 라벨: typography.label
 * - 숫자 정렬: typography.tabularNums
 */

import { SxProps, Theme } from '@mui/material';

// ============================================
// 폰트 패밀리
// ============================================

/** 기본 UI 폰트 */
export const fontFamily = [
  '"Pretendard Variable"',
  'Pretendard',
  '-apple-system',
  'BlinkMacSystemFont',
  'system-ui',
  'sans-serif',
].join(',');

/** 모노스페이스 폰트 (숫자/코드용) */
export const monoFontFamily = [
  '"JetBrains Mono"',
  '"SF Mono"',
  '"Fira Code"',
  'Consolas',
  'monospace',
].join(',');

// ============================================
// 타이포그래피 토큰 (SxProps)
// ============================================

export const typography = {
  /**
   * KPI 대형 숫자 (가장 강조)
   * 사용처: 대시보드 KPI 카드의 주요 숫자
   */
  kpiNumber: {
    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  } as SxProps<Theme>,

  /**
   * KPI 중형 숫자
   * 사용처: 카드 내 보조 수치
   */
  kpiNumberMedium: {
    fontSize: { xs: '1.25rem', sm: '1.5rem' },
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  } as SxProps<Theme>,

  /**
   * KPI 소형 숫자
   * 사용처: 진행률, 카운트 등
   */
  kpiNumberSmall: {
    fontSize: { xs: '0.9rem', sm: '1rem' },
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  } as SxProps<Theme>,

  /**
   * 섹션 타이틀
   * 사용처: 카드/섹션 상단 헤더
   */
  sectionTitle: {
    fontSize: { xs: '0.9rem', sm: '0.95rem' },
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    color: 'text.primary',
  } as SxProps<Theme>,

  /**
   * 카드 타이틀
   * 사용처: 개별 카드 내 제목
   */
  cardTitle: {
    fontSize: { xs: '0.875rem', sm: '0.9rem' },
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.01em',
    color: 'text.primary',
  } as SxProps<Theme>,

  /**
   * 라벨 (대문자)
   * 사용처: KPI 위 라벨, 작은 카테고리명
   */
  label: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'text.secondary',
  } as SxProps<Theme>,

  /**
   * 라벨 (일반)
   * 사용처: 폼 라벨, 설명 라벨
   */
  labelNormal: {
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0.01em',
    color: 'text.secondary',
  } as SxProps<Theme>,

  /**
   * 보조 텍스트
   * 사용처: 설명, 힌트, 작은 정보
   */
  helper: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.5,
    color: 'text.secondary',
  } as SxProps<Theme>,

  /**
   * 타임스탬프/시간
   * 사용처: 마지막 업데이트, 경과 시간
   */
  timestamp: {
    fontSize: '0.7rem',
    fontWeight: 500,
    lineHeight: 1.4,
    color: 'text.disabled',
    fontVariantNumeric: 'tabular-nums',
  } as SxProps<Theme>,

  /**
   * 칩/배지 텍스트
   * 사용처: 상태 칩 내부
   */
  chip: {
    fontSize: '0.7rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  } as SxProps<Theme>,

  /**
   * 숫자 정렬용 (tabular-nums)
   * 사용처: 테이블, 카운터 등
   */
  tabularNums: {
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
  } as SxProps<Theme>,

  /**
   * 모노스페이스 (코드/로그용)
   * 사용처: 에러 코드, 로그 상세
   */
  mono: {
    fontFamily: monoFontFamily,
    fontSize: '0.8rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0',
  } as SxProps<Theme>,

  /**
   * 에러 메시지
   * 사용처: 에러 상세
   */
  error: {
    fontFamily: monoFontFamily,
    fontSize: '0.75rem',
    fontWeight: 500,
    lineHeight: 1.5,
    color: '#EF4444',
  } as SxProps<Theme>,
} as const;

// ============================================
// 컬러 팔레트 (자주 쓰는 색상)
// ============================================

export const colors = {
  // 상태 색상
  running: '#2563EB',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  queued: '#6B7280',
  
  // 텍스트 색상
  textPrimary: '#18181B',
  textSecondary: '#71717A',
  textDisabled: '#A1A1AA',
  
  // 배경 색상
  bgPage: '#FAFAFA',
  bgCard: '#FFFFFF',
  bgMuted: '#F4F4F5',
} as const;

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 상태에 따른 색상 반환
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'RUNNING':
      return colors.running;
    case 'COMPLETED':
    case 'SUCCESS':
      return colors.success;
    case 'FAILED':
    case 'ERROR':
      return colors.error;
    case 'PARTIAL':
    case 'WARNING':
      return colors.warning;
    case 'QUEUED':
    default:
      return colors.queued;
  }
}

/**
 * 성공률에 따른 색상 반환
 */
export function getSuccessRateColor(rate: number): string {
  if (rate >= 80) return colors.success;
  if (rate >= 50) return colors.warning;
  return colors.error;
}

