'use client';

/**
 * 실시간 시계 컴포넌트 - Premium Edition
 * 
 * 최고급 프리미엄 디자인:
 * - 세련된 타이포그래피 (가독성 최적화)
 * - 요일/날짜/시간 분리 표시
 * 
 * 성능 최적화:
 * - memo로 불필요한 리렌더 방지
 * - 이 컴포넌트만 1초 갱신 (전체 페이지 재렌더 방지)
 * - suppressHydrationWarning으로 SSR 불일치 경고 방지
 */

import { useState, useEffect, memo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { AccessTime, CalendarToday } from '@mui/icons-material';

export interface ClockProps {
  /** 표시 형식 */
  variant?: 'full' | 'compact' | 'minimal';
  /** 갱신 간격 (ms) - 기본값 1000 */
  interval?: number;
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const WEEKDAYS_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 최고급 프리미엄 실시간 시계
 */
function ClockComponent({ variant = 'full', interval = 1000 }: ClockProps) {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), interval);
    return () => clearInterval(timer);
  }, [interval]);

  const year = time.getFullYear();
  const month = time.getMonth() + 1;
  const day = time.getDate();
  const weekday = WEEKDAYS[time.getDay()];
  const weekdayShort = WEEKDAYS_SHORT[time.getDay()];
  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');

  // Minimal 버전 (시간만)
  if (variant === 'minimal') {
    return (
      <Typography
        suppressHydrationWarning
        sx={{
          fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'text.primary',
          letterSpacing: '0.02em',
        }}
      >
        {hours}:{minutes}:{seconds}
      </Typography>
    );
  }

  // Compact 버전
  if (variant === 'compact') {
    return (
      <Box
        suppressHydrationWarning
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderRadius: 2,
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.08),
        }}
      >
        <Typography
          sx={{
            fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          {year}.{String(month).padStart(2, '0')}.{String(day).padStart(2, '0')} ({weekdayShort})
        </Typography>
        <Box
          sx={{
            width: 1,
            height: 16,
            backgroundColor: 'divider',
          }}
        />
        <Typography
          sx={{
            fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'text.primary',
            letterSpacing: '0.02em',
          }}
        >
          {hours}:{minutes}
          <Typography
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'text.secondary',
              ml: 0.25,
            }}
          >
            :{seconds}
          </Typography>
        </Typography>
      </Box>
    );
  }

  // Full 버전 - 최고급 프리미엄 (가독성 강화)
  return (
    <Box
      suppressHydrationWarning
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.divider, 1),
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        backgroundColor: 'background.paper',
      }}
    >
      {/* 날짜 섹션 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.875,
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.1)
              : alpha(theme.palette.primary.main, 0.06),
        }}
      >
        <CalendarToday
          sx={{ fontSize: 16, color: 'primary.main' }}
        />
        <Box>
          <Typography
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'primary.main',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}
          >
            {weekday}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'text.primary',
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
            }}
          >
            {year}.{String(month).padStart(2, '0')}.{String(day).padStart(2, '0')}
          </Typography>
        </Box>
      </Box>

      {/* 구분선 */}
      <Box
        sx={{
          width: 1,
          backgroundColor: 'divider',
        }}
      />

      {/* 시간 섹션 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.875,
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.success.main, 0.08)
              : alpha(theme.palette.success.main, 0.04),
        }}
      >
        <AccessTime
          sx={{ fontSize: 16, color: 'success.main' }}
        />
        <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
          <Typography
            sx={{
              fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
              fontSize: '1.125rem',
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {hours}:{minutes}
          </Typography>
          <Typography
            sx={{
              fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'text.secondary',
              ml: 0.25,
              lineHeight: 1,
            }}
          >
            :{seconds}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export const Clock = memo(ClockComponent);
export default Clock;
