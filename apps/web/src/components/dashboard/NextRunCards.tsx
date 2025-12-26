'use client';

/**
 * 섹션 B: Next Run 카드 컴포넌트
 * 컴팩트 프리미엄 디자인 - 다음 실행 예정 스케줄 표시
 */

import { Box, Typography, Paper, Skeleton, Chip, IconButton, Avatar, Button, alpha } from '@mui/material';
import {
  Schedule,
  PlayArrow,
  Edit,
  AccessTime,
  Timer,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

/** Next Run 아이템 */
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
  /** Next Run 아이템들 */
  items: NextRunItem[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 지금 실행 핸들러 */
  onRunNow?: (scheduleId: string) => void;
  /** 편집 핸들러 */
  onEdit?: (scheduleId: string) => void;
}

/** 남은 시간 포맷 */
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

/** 실행 시간 포맷 */
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
          height: '100%',
        }}
      >
        <Skeleton width="50%" height={24} sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={64} sx={{ mb: 1 }} />
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
          p: 3,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Avatar
          sx={{
            width: 56,
            height: 56,
            mb: 2,
            backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.1),
          }}
        >
          <Timer sx={{ fontSize: 28, color: 'warning.main' }} />
        </Avatar>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          예정된 자동 게시가 없습니다
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          스케줄을 설정하면 자동으로 게시됩니다
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push('/schedules/new')}
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
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.1),
            }}
          >
            <Timer sx={{ fontSize: 18, color: 'warning.main' }} />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              다음 실행
            </Typography>
            <Typography variant="caption" color="text.secondary">
              예정된 자동 게시
            </Typography>
          </Box>
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
                gap: 2,
                px: 2.5,
                py: 2,
                borderBottom: index < Math.min(items.length, 3) - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                transition: 'background-color 0.15s ease',
                backgroundColor: index === 0 
                  ? (theme) => alpha(theme.palette.primary.main, 0.03) 
                  : 'transparent',
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.action.hover, 0.5),
                },
              }}
            >
              {/* 순번 */}
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  backgroundColor: index === 0 ? 'primary.main' : 'action.hover',
                  color: index === 0 ? 'white' : 'text.secondary',
                }}
              >
                {index + 1}
              </Box>

              {/* 내용 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    mb: 0.25,
                  }}
                >
                  {item.scheduleName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <AccessTime sx={{ fontSize: 12 }} />
                  {formatRunTime(item.nextRunAt)} · {item.cafeName}
                </Typography>
              </Box>

              {/* 남은 시간 + 액션 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Chip
                  label={formatRemainingTime(item.remainingMinutes)}
                  size="small"
                  color={isUrgent ? 'warning' : 'default'}
                  sx={{
                    fontWeight: 600,
                    height: 24,
                    fontSize: 11,
                    backgroundColor: isUrgent 
                      ? (theme) => alpha(theme.palette.warning.main, 0.15)
                      : 'action.hover',
                    color: isUrgent ? 'warning.dark' : 'text.secondary',
                    border: 'none',
                  }}
                />
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <IconButton
                    size="small"
                    onClick={() => onEdit?.(item.scheduleId)}
                    sx={{ 
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    <Edit sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => onRunNow?.(item.scheduleId)}
                    sx={{ 
                      color: 'primary.main',
                      '&:hover': { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1) },
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 18 }} />
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


