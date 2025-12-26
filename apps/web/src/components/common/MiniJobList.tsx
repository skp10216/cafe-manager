'use client';

/**
 * 미니 작업 리스트 컴포넌트
 * 대시보드 카드 내부에서 최근 작업 3건을 표시
 */

import { Box, Typography, Skeleton } from '@mui/material';
import {
  Schedule,
  CheckCircle,
  Error as ErrorIcon,
  Sync,
  Article,
  Delete,
  Login,
} from '@mui/icons-material';
import StatusChip from './StatusChip';

/** 미니 작업 아이템 타입 */
export interface MiniJobItem {
  jobId: string;
  type: string;
  templateName: string | null;
  scheduleName: string | null;
  cafeName: string | null;
  boardName: string | null;
  createdAt: string;
  finishedAt: string | null;
  status: string;
  resultUrl: string | null;
  errorCategory: string | null;
  errorSummary: string | null;
}

interface MiniJobListProps {
  /** 작업 목록 */
  items: MiniJobItem[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 빈 상태 메시지 */
  emptyMessage?: string;
  /** 아이템 클릭 핸들러 */
  onItemClick?: (jobId: string) => void;
}

/** 작업 타입별 아이콘 */
const JOB_TYPE_ICONS: Record<string, typeof Schedule> = {
  INIT_SESSION: Login,
  VERIFY_SESSION: Login,
  CREATE_POST: Article,
  SYNC_POSTS: Sync,
  DELETE_POST: Delete,
};

/** 작업 타입별 한글 라벨 */
const JOB_TYPE_LABELS: Record<string, string> = {
  INIT_SESSION: '세션 연동',
  VERIFY_SESSION: '세션 검증',
  CREATE_POST: '게시글 작성',
  SYNC_POSTS: '동기화',
  DELETE_POST: '삭제',
};

/** 상대 시간 포맷 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MiniJobList({
  items,
  loading = false,
  emptyMessage = '최근 작업이 없습니다',
  onItemClick,
}: MiniJobListProps) {
  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} />
        ))}
      </Box>
    );
  }

  // 빈 상태
  if (items.length === 0) {
    return (
      <Box
        sx={{
          py: 2,
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="caption">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {items.map((item) => {
        const Icon = JOB_TYPE_ICONS[item.type] || Schedule;
        const typeLabel = JOB_TYPE_LABELS[item.type] || item.type;
        
        // 표시할 대상 정보 결정
        const targetInfo = item.templateName
          ? `${item.templateName}`
          : item.scheduleName
          ? `${item.scheduleName}`
          : typeLabel;
        
        const subInfo = item.boardName || item.cafeName || null;

        return (
          <Box
            key={item.jobId}
            onClick={() => onItemClick?.(item.jobId)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              cursor: onItemClick ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease',
              '&:hover': onItemClick
                ? { backgroundColor: 'action.hover' }
                : {},
            }}
          >
            {/* 아이콘 */}
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '6px',
                backgroundColor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </Box>

            {/* 정보 */}
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
                {targetInfo}
              </Typography>
              {subInfo && (
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
                  {subInfo}
                </Typography>
              )}
            </Box>

            {/* 시간 + 상태 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(item.finishedAt || item.createdAt)}
              </Typography>
              <StatusChip
                status={item.status as 'COMPLETED' | 'FAILED' | 'PENDING' | 'PROCESSING'}
                size="small"
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}


