'use client';

/**
 * 섹션 B: 오늘 예정 타임라인 컴포넌트
 * 컴팩트 프리미엄 디자인 - 오늘 예정된 게시 작업을 시간순으로 표시
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  Chip,
  IconButton,
  Avatar,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import {
  Schedule,
  CheckCircle,
  Error as ErrorIcon,
  Sync,
  PlayArrow,
  Edit,
  Pause,
  MoreVert,
  OpenInNew,
  CalendarMonth,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

/** 타임라인 상태 */
type TimelineStatus = 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/** 타임라인 아이템 */
export interface TimelineItem {
  scheduleId: string;
  scheduleName: string;
  templateId: string;
  templateName: string;
  cafeId: string;
  cafeName: string;
  boardId: string;
  boardName: string;
  nextRunAt: string;
  status: TimelineStatus;
  preview: {
    subject: string;
    contentSnippet: string;
    thumbnailUrl: string | null;
    imageCount: number;
  };
  relatedJobId?: string;
  resultUrl?: string;
  errorSummary?: string;
}

interface TodayTimelineProps {
  /** 타임라인 아이템들 */
  items: TimelineItem[];
  /** 통계 */
  stats: {
    totalScheduledToday: number;
    completedToday: number;
    failedToday: number;
  };
  /** 로딩 상태 */
  loading?: boolean;
  /** 지금 실행 핸들러 */
  onRunNow?: (scheduleId: string) => void;
  /** 스케줄 편집 핸들러 */
  onEdit?: (scheduleId: string) => void;
  /** 스케줄 일시중지 핸들러 */
  onPause?: (scheduleId: string) => void;
}

/** 상태별 설정 */
const STATUS_CONFIG: Record<
  TimelineStatus,
  {
    label: string;
    color: 'default' | 'primary' | 'success' | 'error';
    icon: React.ElementType;
    bgColor: string;
    textColor: string;
  }
> = {
  SCHEDULED: {
    label: '예정',
    color: 'default',
    icon: Schedule,
    bgColor: '#F1F5F9',
    textColor: '#64748B',
  },
  PROCESSING: {
    label: '진행 중',
    color: 'primary',
    icon: Sync,
    bgColor: '#EFF6FF',
    textColor: '#2563EB',
  },
  COMPLETED: {
    label: '완료',
    color: 'success',
    icon: CheckCircle,
    bgColor: '#ECFDF5',
    textColor: '#10B981',
  },
  FAILED: {
    label: '실패',
    color: 'error',
    icon: ErrorIcon,
    bgColor: '#FEF2F2',
    textColor: '#EF4444',
  },
};

/** 시간 포맷 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TodayTimeline({
  items,
  stats,
  loading = false,
  onRunNow,
  onEdit,
  onPause,
}: TodayTimelineProps) {
  const router = useRouter();
  const [menuAnchor, setMenuAnchor] = useState<{
    element: HTMLElement;
    item: TimelineItem;
  } | null>(null);

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
          <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />
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
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
          }}
        >
          <CalendarMonth sx={{ fontSize: 28, color: 'primary.main' }} />
        </Avatar>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          오늘 예정된 게시가 없습니다
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          스케줄을 설정하면 여기에 표시됩니다
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => router.push('/schedules')}
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
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <CalendarMonth sx={{ fontSize: 18, color: 'primary.main' }} />
          </Avatar>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              오늘 예정
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats.totalScheduledToday}건 · 완료 {stats.completedToday} · 실패 {stats.failedToday}
            </Typography>
          </Box>
        </Box>
        <Button
          size="small"
          variant="text"
          onClick={() => router.push('/schedules')}
          sx={{ minWidth: 'auto', px: 1 }}
        >
          전체
        </Button>
      </Box>

      {/* 타임라인 리스트 - 최대 4개만 표시 */}
      <Box sx={{ flex: 1, overflow: 'auto', maxHeight: 240 }}>
        {items.slice(0, 4).map((item, index) => {
          const config = STATUS_CONFIG[item.status];
          const StatusIcon = config.icon;

          return (
            <Box
              key={item.scheduleId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2.5,
                py: 1.5,
                borderBottom: index < Math.min(items.length, 4) - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              {/* 시간 */}
              <Typography
                variant="body2"
                sx={{
                  width: 48,
                  flexShrink: 0,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: config.textColor,
                }}
              >
                {formatTime(item.nextRunAt)}
              </Typography>

              {/* 상태 아이콘 */}
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  backgroundColor: config.bgColor,
                  flexShrink: 0,
                }}
              >
                <StatusIcon sx={{ fontSize: 16, color: config.textColor }} />
              </Avatar>

              {/* 내용 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.templateName}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.cafeName} · {item.boardName}
                </Typography>
              </Box>

              {/* 상태 칩 + 액션 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                <Chip
                  label={config.label}
                  size="small"
                  color={config.color}
                  sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                />
                {item.status === 'COMPLETED' && item.resultUrl && (
                  <IconButton
                    size="small"
                    href={item.resultUrl}
                    target="_blank"
                    sx={{ color: 'success.main' }}
                  >
                    <OpenInNew sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchor({ element: e.currentTarget, item })}
                >
                  <MoreVert sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* 더보기 */}
      {items.length > 4 && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
            backgroundColor: (theme) => alpha(theme.palette.action.hover, 0.3),
          }}
        >
          <Button
            size="small"
            variant="text"
            onClick={() => router.push('/schedules')}
          >
            +{items.length - 4}건 더 보기
          </Button>
        </Box>
      )}

      {/* 컨텍스트 메뉴 */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            onRunNow?.(menuAnchor!.item.scheduleId);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <PlayArrow fontSize="small" />
          </ListItemIcon>
          <ListItemText>지금 실행</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onEdit?.(menuAnchor!.item.scheduleId);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>편집</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onPause?.(menuAnchor!.item.scheduleId);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Pause fontSize="small" />
          </ListItemIcon>
          <ListItemText>일시중지</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
}


