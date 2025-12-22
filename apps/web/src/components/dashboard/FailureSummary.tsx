'use client';

/**
 * 섹션 D: 실패 요약 컴포넌트
 * 컴팩트 프리미엄 디자인 - 실패 원인 카테고리별 요약
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
  BugReport,
  Celebration,
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

  // 로딩 상태
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Skeleton width="50%" height={24} sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 2 }}>
            <Skeleton width="60%" height={16} sx={{ mb: 0.5 }} />
            <Skeleton variant="rounded" height={6} />
          </Box>
        ))}
      </Paper>
    );
  }

  // 빈 상태 (실패 없음 - 축하!)
  if (topCategories.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Avatar
          sx={{
            width: 48,
            height: 48,
            mb: 2,
            mx: 'auto',
            backgroundColor: (theme) => alpha(theme.palette.success.main, 0.1),
          }}
        >
          <Celebration sx={{ fontSize: 24, color: 'success.main' }} />
        </Avatar>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          실패 없음! 🎉
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {period === 'TODAY' ? '오늘' : '이번 주'} 모든 작업이 성공했습니다
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.03),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
            }}
          >
            <BugReport sx={{ fontSize: 18, color: 'error.main' }} />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              실패 분석
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {period === 'TODAY' ? '오늘' : '이번 주'} {totalFailures}건
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 카테고리 리스트 - Top 4만 표시 */}
      <Box sx={{ p: 2 }}>
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
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 500, color: 'text.primary' }}
                  >
                    {item.label}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color }}
                  >
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
                  backgroundColor: alpha(color, 0.15),
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
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: (theme) => alpha(theme.palette.action.hover, 0.3),
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          💡 가장 많은 원인을 해결하면 성공률이 크게 올라갑니다
        </Typography>
      </Box>
    </Paper>
  );
}
