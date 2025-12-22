'use client';

/**
 * 네이버 연동 상태 칩 컴포넌트
 * 3단계 상태 표시: 정상 / 주의 / 조치 필요 / 미연결
 */

import { Chip, ChipProps, Tooltip } from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  LinkOff,
} from '@mui/icons-material';

/** 연동 상태 타입 */
export type IntegrationStatusType =
  | 'OK'              // 정상 (자동 실행 가능)
  | 'WARNING'         // 주의 (곧 만료/확인 필요)
  | 'ACTION_REQUIRED' // 조치 필요 (재연동 필요)
  | 'NOT_CONNECTED';  // 미연결

interface IntegrationStatusChipProps {
  /** 상태 */
  status: IntegrationStatusType;
  /** 상태 사유 (툴팁으로 표시) */
  statusReason?: string;
  /** 크기 */
  size?: ChipProps['size'];
  /** 클릭 핸들러 */
  onClick?: () => void;
}

/** 상태별 설정 */
const statusConfig: Record<
  IntegrationStatusType,
  {
    label: string;
    color: 'success' | 'warning' | 'error' | 'default';
    icon: React.ElementType;
    backgroundColor: string;
    textColor: string;
  }
> = {
  OK: {
    label: '정상',
    color: 'success',
    icon: CheckCircle,
    backgroundColor: '#DCFCE7',
    textColor: '#166534',
  },
  WARNING: {
    label: '확인 필요',
    color: 'warning',
    icon: Warning,
    backgroundColor: '#FEF3C7',
    textColor: '#92400E',
  },
  ACTION_REQUIRED: {
    label: '조치 필요',
    color: 'error',
    icon: ErrorIcon,
    backgroundColor: '#FEE2E2',
    textColor: '#991B1B',
  },
  NOT_CONNECTED: {
    label: '미연결',
    color: 'default',
    icon: LinkOff,
    backgroundColor: '#F1F5F9',
    textColor: '#475569',
  },
};

export default function IntegrationStatusChip({
  status,
  statusReason,
  size = 'medium',
  onClick,
}: IntegrationStatusChipProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const chip = (
    <Chip
      label={config.label}
      size={size}
      icon={<Icon />}
      onClick={onClick}
      sx={{
        backgroundColor: config.backgroundColor,
        color: config.textColor,
        fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        '& .MuiChip-icon': {
          color: config.textColor,
        },
        '&:hover': onClick
          ? {
              filter: 'brightness(0.95)',
            }
          : {},
        transition: 'all 0.2s ease',
      }}
    />
  );

  if (statusReason) {
    return (
      <Tooltip title={statusReason} arrow placement="top">
        {chip}
      </Tooltip>
    );
  }

  return chip;
}
