'use client';

/**
 * 상태 표시 칩 컴포넌트
 */

import { Chip, ChipProps } from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Schedule,
  HourglassEmpty,
  Cancel,
} from '@mui/icons-material';

type StatusType =
  | 'ACTIVE'
  | 'PAUSED'
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'ERROR'
  | 'DELETED'
  | 'UNKNOWN';

interface StatusChipProps {
  status: StatusType;
  size?: ChipProps['size'];
}

/** 상태별 설정 */
const statusConfig: Record<
  StatusType,
  { label: string; color: ChipProps['color']; icon: typeof CheckCircle }
> = {
  ACTIVE: { label: '활성', color: 'success', icon: CheckCircle },
  PAUSED: { label: '일시정지', color: 'default', icon: HourglassEmpty },
  PENDING: { label: '대기 중', color: 'default', icon: Schedule },
  PROCESSING: { label: '처리 중', color: 'info', icon: Schedule },
  COMPLETED: { label: '완료', color: 'success', icon: CheckCircle },
  FAILED: { label: '실패', color: 'error', icon: Error },
  CANCELLED: { label: '취소됨', color: 'default', icon: Cancel },
  EXPIRED: { label: '만료됨', color: 'warning', icon: Warning },
  ERROR: { label: '오류', color: 'error', icon: Error },
  DELETED: { label: '삭제됨', color: 'default', icon: Cancel },
  UNKNOWN: { label: '알 수 없음', color: 'default', icon: HourglassEmpty },
};

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = statusConfig[status] || statusConfig.UNKNOWN;
  const Icon = config.icon;

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={<Icon />}
      sx={{ fontWeight: 500 }}
    />
  );
}




