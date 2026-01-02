'use client';

/**
 * 인사이트 카드 (구 FailureSummary) - Premium Edition
 * 
 * 상태 기반 인사이트 카드:
 * - 실패 0: "오늘 모든 작업이 정상 완료" (축하/신뢰)
 * - 실패 있음: "실패 n건이 있습니다" + CTA
 * - 실패 원인 분석 표시
 */

import {
  Box,
  Typography,
  Paper,
  Skeleton,
  LinearProgress,
  IconButton,
  Tooltip,
  Avatar,
  alpha,
  Button,
  Stack,
} from '@mui/material';
import {
  Login,
  Block,
  Code,
  Image as ImageIcon,
  Wifi,
  SearchOff,
  Timer,
  HelpOutline,
  OpenInNew,
  Celebration,
  Warning,
  CheckCircle,
  TrendingUp,
  Shield,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

/** 에러 카테고리 타입 */
type ErrorCategory =
  | 'LOGIN_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'EDITOR_LOAD_FAIL'
  | 'IMAGE_UPLOAD_FAIL'
  | 'NETWORK_ERROR'
  | 'CAFE_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/** 실패 카테고리 아이템 */
export interface FailureCategoryItem {
  category: ErrorCategory;
  label: string;
  count: number;
  percentage: number;
  latestJobId: string;
}

interface FailureSummaryProps {
  /** Top 카테고리들 */
  topCategories: FailureCategoryItem[];
  /** 총 실패 수 */
  totalFailures: number;
  /** 기간 */
  period: 'TODAY' | 'WEEK';
  /** 로딩 상태 */
  loading?: boolean;
  /** Job 상세 보기 핸들러 */
  onViewJob?: (jobId: string) => void;
}

/** 카테고리별 아이콘 */
const CATEGORY_ICONS: Record<ErrorCategory, React.ElementType> = {
  LOGIN_REQUIRED: Login,
  PERMISSION_DENIED: Block,
  EDITOR_LOAD_FAIL: Code,
  IMAGE_UPLOAD_FAIL: ImageIcon,
  NETWORK_ERROR: Wifi,
  CAFE_NOT_FOUND: SearchOff,
  RATE_LIMITED: Timer,
  UNKNOWN: HelpOutline,
};

/** 카테고리별 색상 */
const CATEGORY_COLORS: Record<ErrorCategory, string> = {
  LOGIN_REQUIRED: '#EF4444',
  PERMISSION_DENIED: '#F59E0B',
  EDITOR_LOAD_FAIL: '#8B5CF6',
  IMAGE_UPLOAD_FAIL: '#EC4899',
  NETWORK_ERROR: '#06B6D4',
  CAFE_NOT_FOUND: '#6366F1',
  RATE_LIMITED: '#F97316',
  UNKNOWN: '#64748B',
};

export default function FailureSummary({
  topCategories,
  totalFailures,
  period,
  loading = false,
  onViewJob,
}: FailureSummaryProps) {
  const router = useRouter();
  const periodText = period === 'TODAY' ? '오늘' : '이번 주';

  // 로딩 상태
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          height: '100%',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="40%" height={16} />
          </Box>
        </Box>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <Skeleton width="60%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton variant="rounded" height={6} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Paper>
    );
  }

  // ========================================
  // 상태 A: 실패 없음 - 축하/신뢰 카드
  // ========================================
  if (totalFailures === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '2px solid',
          borderColor: (theme) => alpha(theme.palette.success.main, 0.3),
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.main, 0.02)} 100%)`,
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <Box
          sx={{
            px: 2.5,
            py: 2,
            borderBottom: '1px solid',
            borderColor: (theme) => alpha(theme.palette.success.main, 0.15),
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              backgroundColor: (theme) => alpha(theme.palette.success.main, 0.15),
            }}
          >
            <Shield sx={{ fontSize: 22, color: 'success.main' }} />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'success.dark', lineHeight: 1.2 }}>
              운영 상태
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {periodText} 기준
            </Typography>
          </Box>
        </Box>

        {/* 축하 메시지 */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Avatar
            sx={{
              width: 64,
              height: 64,
              mb: 2,
              backgroundColor: (theme) => alpha(theme.palette.success.main, 0.12),
            }}
          >
            <Celebration sx={{ fontSize: 32, color: 'success.main' }} />
          </Avatar>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: 'success.main',
              mb: 0.5,
            }}
          >
            실패 없음! 🎉
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {periodText} 모든 작업이 성공적으로 완료되었습니다
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main' }}>
              시스템 정상 작동 중
            </Typography>
          </Stack>
        </Box>
      </Paper>
    );
  }

  // ========================================
  // 상태 B: 실패 있음 - 경고/분석 카드
  // ========================================
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: (theme) => alpha(theme.palette.error.main, 0.25),
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 - 경고 스타일 */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.06),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.12),
            }}
          >
            <Warning sx={{ fontSize: 22, color: 'error.main' }} />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'error.main', lineHeight: 1.2 }}>
              실패 {totalFailures}건
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {periodText} · 확인이 필요합니다
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="contained"
          color="error"
          onClick={() => router.push('/logs?status=FAILED')}
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          실패 보기
        </Button>
      </Box>

      {/* 실패 원인 분석 */}
      <Box sx={{ flex: 1, p: 2.5 }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mb: 2,
            fontWeight: 600,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          실패 원인 분석
        </Typography>

        {/* Top 카테고리 리스트 */}
        {topCategories.slice(0, 4).map((item, index) => {
          const Icon = CATEGORY_ICONS[item.category];
          const color = CATEGORY_COLORS[item.category];

          return (
            <Box
              key={item.category}
              sx={{
                mb: index < Math.min(topCategories.length, 4) - 1 ? 2 : 0,
              }}
            >
              {/* 카테고리 헤더 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.75,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Icon sx={{ fontSize: 16, color }} />
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {item.label}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color }}>
                    {item.count}건
                  </Typography>
                  <Tooltip title="로그 보기">
                    <IconButton
                      size="small"
                      onClick={() => onViewJob?.(item.latestJobId)}
                      sx={{
                        p: 0.25,
                        '&:hover': { backgroundColor: alpha(color, 0.1) },
                      }}
                    >
                      <OpenInNew sx={{ fontSize: 14, color: 'text.secondary' }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* 프로그레스 바 */}
              <LinearProgress
                variant="determinate"
                value={item.percentage}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: alpha(color, 0.12),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: color,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>

      {/* 팁 */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.06),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            color: 'warning.dark',
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          <TrendingUp sx={{ fontSize: 14 }} />
          가장 많은 원인을 해결하면 성공률이 크게 올라갑니다
        </Typography>
      </Box>
    </Paper>
  );
}


