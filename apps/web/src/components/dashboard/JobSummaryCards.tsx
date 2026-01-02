'use client';

/**
 * 섹션 B: 작업 현황 카드 컴포넌트 - Premium Edition v3
 * 
 * Linear/Notion 스타일 콘솔 감성:
 * - KPI 숫자 tabular-nums 적용
 * - 타이포그래피 토큰 적용
 * - 담백하고 전문적인 UI
 * - 성공/실패 2개 KPI만 표시 (시도/진행중 중복 제거)
 */

import { Box, Typography, Paper, Skeleton, alpha, Stack } from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { typography, colors } from '@/lib/typography';

/** 카드 데이터 타입 */
interface CardData {
  count: number;
  recent: { id: string; name: string; status: string; time: string }[];
}

/** 작업 요약 데이터 */
interface JobSummaryData {
  today: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
  };
  cards: {
    todayJobs: CardData;
    completed: CardData;
    failed: CardData;
    processing: CardData;
  };
}

interface JobSummaryCardsProps {
  data: JobSummaryData | null;
  loading?: boolean;
  onJobClick?: (jobId: string) => void;
}

export default function JobSummaryCards({
  data,
  loading = false,
  onJobClick,
}: JobSummaryCardsProps) {
  const router = useRouter();

  const handleCardClick = (filterParam: string) => {
    const url = filterParam ? `/logs?${filterParam}` : '/logs';
    router.push(url);
  };

  if (loading) {
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Skeleton variant="rounded" height={100} sx={{ flex: 1, borderRadius: 2.5 }} />
        <Skeleton variant="rounded" height={100} sx={{ flex: 1, borderRadius: 2.5 }} />
      </Stack>
    );
  }

  const completedCount = data?.cards.completed?.count ?? 0;
  const failedCount = data?.cards.failed?.count ?? 0;

  const failedColor = failedCount > 0 ? colors.error : colors.success;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        {/* 성공 게시 카드 */}
        <Paper
          elevation={0}
          onClick={() => handleCardClick('status=COMPLETED')}
          sx={{
            flex: 1,
            p: 2.5,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: alpha(colors.success, 0.2),
            backgroundColor: alpha(colors.success, 0.02),
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: colors.success,
            },
            '&:hover': {
              borderColor: alpha(colors.success, 0.4),
              backgroundColor: alpha(colors.success, 0.04),
              transform: 'translateY(-1px)',
              boxShadow: `0 4px 12px ${alpha(colors.success, 0.1)}`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ ...typography.label, color: colors.success, mb: 0.75 }}>
                성공 게시
              </Typography>
              <Typography
                sx={{
                  ...typography.kpiNumber,
                  color: colors.success,
                }}
              >
                {completedCount}
                <Typography
                  component="span"
                  sx={{ ...typography.helper, ml: 0.5, color: alpha(colors.success, 0.7) }}
                >
                  건
                </Typography>
              </Typography>
            </Box>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(colors.success, 0.1),
              }}
            >
              <CheckCircle sx={{ fontSize: 24, color: colors.success }} />
            </Box>
          </Box>
        </Paper>

        {/* 실패 카드 */}
        <Paper
          elevation={0}
          onClick={() => handleCardClick('status=FAILED')}
          sx={{
            flex: 1,
            p: 2.5,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: alpha(failedColor, failedCount > 0 ? 0.3 : 0.15),
            backgroundColor: alpha(failedColor, 0.02),
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: failedColor,
            },
            '&:hover': {
              borderColor: alpha(failedColor, 0.4),
              backgroundColor: alpha(failedColor, 0.04),
              transform: 'translateY(-1px)',
              boxShadow: `0 4px 12px ${alpha(failedColor, 0.1)}`,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ ...typography.label, color: failedColor, mb: 0.75 }}>
                실패
              </Typography>
              <Typography
                sx={{
                  ...typography.kpiNumber,
                  color: failedColor,
                }}
              >
                {failedCount}
                <Typography
                  component="span"
                  sx={{ ...typography.helper, ml: 0.5, color: alpha(failedColor, 0.7) }}
                >
                  건
                </Typography>
              </Typography>
            </Box>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(failedColor, 0.1),
              }}
            >
              {failedCount > 0 ? (
                <ErrorIcon sx={{ fontSize: 24, color: failedColor }} />
              ) : (
                <CheckCircle sx={{ fontSize: 24, color: failedColor }} />
              )}
            </Box>
          </Box>
          {failedCount === 0 && (
            <Typography sx={{ ...typography.helper, mt: 1, color: colors.success }}>
              ✨ 오늘 실패 없음
            </Typography>
          )}
        </Paper>
    </Stack>
  );
}
