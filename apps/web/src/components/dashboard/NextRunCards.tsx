'use client';

/**
 * 섹션 B: Next Run 카드 컴포넌트 - Premium Edition v2
 * 
 * Linear/Notion 스타일 콘솔 감성:
 * - 타이포그래피 토큰 적용
 * - 담백하고 전문적인 UI
 */

import { Box, Typography, Paper, Skeleton, Chip, IconButton, Avatar, Button, alpha } from '@mui/material';
import {
  PlayArrow,
  Edit,
  AccessTime,
  Timer,
  Add,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { typography, colors } from '@/lib/typography';

export interface NextRunItem {
  scheduleId: string;
  scheduleName: string;
  templateName: string;
  cafeName: string;
  boardName: string;
  nextRunAt: string;
  remainingMinutes: number;
}

interface NextRunCardsProps {
  items: NextRunItem[];
  loading?: boolean;
  onRunNow?: (scheduleId: string) => void;
  onEdit?: (scheduleId: string) => void;
}

function formatRemainingTime(minutes: number): string {
  if (minutes < 1) return '곧 실행';
  if (minutes < 60) return `${minutes}분 후`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}시간 ${mins}분 후` : `${hours}시간 후`;
  }
  const days = Math.floor(hours / 24);
  return `${days}일 후`;
}

function formatRunTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NextRunCards({
  items,
  loading = false,
  onRunNow,
  onEdit,
}: NextRunCardsProps) {
  const router = useRouter();

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          height: '100%',
        }}
      >
        <Skeleton width="40%" height={20} sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1, borderRadius: 2 }} />
        ))}
      </Paper>
    );
  }

  // 빈 상태
  if (items.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2.5,
          border: '1px dashed',
          borderColor: 'divider',
          backgroundColor: alpha('#000', 0.01),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 38,
              height: 38,
              backgroundColor: alpha(colors.warning, 0.08),
            }}
          >
            <Timer sx={{ fontSize: 20, color: colors.warning }} />
          </Avatar>
          <Box>
            <Typography sx={{ ...typography.cardTitle, mb: 0.125 }}>
              예정된 자동 게시가 없습니다
            </Typography>
            <Typography sx={{ ...typography.helper }}>
              스케줄을 설정하면 자동으로 게시됩니다
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Add sx={{ fontSize: 16 }} />}
          onClick={() => router.push('/schedules/new')}
          sx={{ 
            flexShrink: 0, 
            ...typography.chip,
            height: 32,
            borderRadius: 1.5,
          }}
        >
          스케줄 만들기
        </Button>
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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            backgroundColor: alpha(colors.warning, 0.08),
          }}
        >
          <Timer sx={{ fontSize: 18, color: colors.warning }} />
        </Avatar>
        <Box>
          <Typography sx={{ ...typography.sectionTitle, lineHeight: 1.2 }}>
            다음 실행
          </Typography>
          <Typography sx={{ ...typography.helper, fontSize: '0.65rem' }}>
            예정된 자동 게시
          </Typography>
        </Box>
      </Box>

      {/* 리스트 */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {items.slice(0, 3).map((item, index) => {
          const isUrgent = item.remainingMinutes < 30;

          return (
            <Box
              key={item.scheduleId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                borderBottom: index < Math.min(items.length, 3) - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                transition: 'background-color 0.12s ease',
                backgroundColor: index === 0 ? alpha(colors.running, 0.02) : 'transparent',
                '&:hover': {
                  backgroundColor: alpha('#000', 0.02),
                },
              }}
            >
              {/* 순번 */}
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: index === 0 ? colors.running : alpha('#000', 0.04),
                  color: index === 0 ? 'white' : 'text.secondary',
                  ...typography.chip,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {index + 1}
              </Box>

              {/* 내용 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    ...typography.cardTitle,
                    fontSize: '0.85rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    mb: 0.125,
                  }}
                >
                  {item.scheduleName}
                </Typography>
                <Typography
                  sx={{
                    ...typography.timestamp,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <AccessTime sx={{ fontSize: 11 }} />
                  {formatRunTime(item.nextRunAt)} · {item.cafeName}
                </Typography>
              </Box>

              {/* 남은 시간 + 액션 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                <Chip
                  label={
                    <Typography sx={{ ...typography.chip, fontVariantNumeric: 'tabular-nums' }}>
                      {formatRemainingTime(item.remainingMinutes)}
                    </Typography>
                  }
                  size="small"
                  sx={{
                    height: 24,
                    backgroundColor: isUrgent ? alpha(colors.warning, 0.1) : alpha('#000', 0.04),
                    color: isUrgent ? colors.warning : 'text.secondary',
                    border: 'none',
                  }}
                />
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <IconButton
                    size="small"
                    onClick={() => onEdit?.(item.scheduleId)}
                    sx={{
                      width: 26,
                      height: 26,
                      color: 'text.disabled',
                      '&:hover': { color: colors.running },
                    }}
                  >
                    <Edit sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => onRunNow?.(item.scheduleId)}
                    sx={{
                      width: 26,
                      height: 26,
                      color: colors.running,
                      '&:hover': { backgroundColor: alpha(colors.running, 0.08) },
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
