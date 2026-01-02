'use client';

/**
 * 섹션 A: 연동 상태 배너 컴포넌트
 * 네이버 미연동/세션 만료/에러 시 강조 배너 노출
 * 최고급 프리미엄 디자인 - 회원가입 후 첫 접속 시 하이라이트
 */

import { Box, Typography, Button, Paper, Skeleton, Avatar, keyframes } from '@mui/material';
import {
  LinkOff,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  Refresh,
  ArrowForward,
  AutoAwesome,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

/** 연동 상태 타입 */
type IntegrationStatusType = 'OK' | 'WARNING' | 'ACTION_REQUIRED' | 'NOT_CONNECTED';

interface IntegrationStatusBannerProps {
  /** 연동 상태 */
  status: IntegrationStatusType;
  /** 상태 사유 */
  statusReason: string;
  /** 계정 정보 */
  account: {
    loginId: string;
    displayName: string | null;
  } | null;
  /** 세션 정보 */
  session: {
    id: string;
    status: string;
    lastVerifiedAt: string | null;
    naverNickname: string | null;
  } | null;
  /** 로딩 상태 */
  loading?: boolean;
  /** 재연동 핸들러 */
  onReconnect?: () => void;
  /** 세션 검증 핸들러 */
  onVerify?: () => void;
}

// 애니메이션 정의
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
`;

/** 상태별 설정 */
const STATUS_CONFIG: Record<
  IntegrationStatusType,
  {
    icon: React.ElementType;
    title: string;
    bgColor: string;
    borderColor: string;
    iconColor: string;
    textColor: string;
    show: boolean;
  }
> = {
  OK: {
    icon: CheckCircle,
    title: '네이버 연동 정상',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    iconColor: '#22C55E',
    textColor: '#166534',
    show: true, // 정상일 때도 연동 정보 표시
  },
  WARNING: {
    icon: Warning,
    title: '네이버 연동 상태 확인 필요',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    iconColor: '#F59E0B',
    textColor: '#92400E',
    show: true,
  },
  ACTION_REQUIRED: {
    icon: ErrorIcon,
    title: '네이버 재연동이 필요합니다',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA',
    iconColor: '#EF4444',
    textColor: '#991B1B',
    show: true,
  },
  NOT_CONNECTED: {
    icon: LinkOff,
    title: '네이버 연동을 시작하세요',
    bgColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    iconColor: '#64748B',
    textColor: '#334155',
    show: true,
  },
};

export default function IntegrationStatusBanner({
  status,
  statusReason,
  account,
  session,
  loading = false,
  onReconnect,
  onVerify,
}: IntegrationStatusBannerProps) {
  const router = useRouter();
  const config = STATUS_CONFIG[status];

  // 로딩 상태
  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={56} height={56} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="60%" height={28} />
            <Skeleton width="40%" height={20} sx={{ mt: 0.5 }} />
          </Box>
          <Skeleton variant="rounded" width={140} height={44} />
        </Box>
      </Paper>
    );
  }

  // 정상 상태 (OK) - 컴팩트 연동 정보 표시
  if (status === 'OK') {
    return (
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'rgba(34, 197, 94, 0.2)',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(34, 197, 94, 0.05)'
              : 'linear-gradient(135deg, rgba(34, 197, 94, 0.04) 0%, rgba(255, 255, 255, 1) 100%)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
          }}
        >
          {/* 네이버 아바타 + 체크 */}
          <Box sx={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              sx={{
                width: 44,
                height: 44,
                background: 'linear-gradient(135deg, #03C75A 0%, #00A344 100%)',
                fontSize: '1.25rem',
                fontWeight: 800,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              N
            </Avatar>
            <CheckCircle
              sx={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                fontSize: 18,
                color: '#22C55E',
                backgroundColor: 'white',
                borderRadius: '50%',
              }}
            />
          </Box>

          {/* 연동 정보 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, color: 'text.primary' }}
              >
                네이버 연동 완료
              </Typography>
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: '#22C55E',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                }}
              >
                정상
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}
            >
              {account?.loginId}
              {session?.naverNickname && (
                <Typography
                  component="span"
                  sx={{
                    ml: 0.75,
                    px: 0.75,
                    py: 0.125,
                    borderRadius: 0.5,
                    backgroundColor: 'rgba(0,0,0,0.04)',
                    fontSize: '0.75rem',
                    color: 'text.primary',
                    fontWeight: 500,
                  }}
                >
                  {session.naverNickname}
                </Typography>
              )}
            </Typography>
          </Box>

          {/* 설정 버튼 */}
          <Button
            size="small"
            variant="text"
            onClick={() => router.push('/settings')}
            sx={{
              color: 'text.secondary',
              fontSize: '0.75rem',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
            }}
          >
            설정
          </Button>
        </Box>
      </Paper>
    );
  }

  // NOT_CONNECTED 상태 (미연동) - 컴팩트 프리미엄 디자인
  if (status === 'NOT_CONNECTED') {
    return (
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2.5,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' 
            ? 'rgba(3, 199, 90, 0.3)' 
            : 'rgba(3, 199, 90, 0.25)',
          // 네이버 그린 톤 그라데이션 배경
          background: (theme) => theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, rgba(3, 199, 90, 0.08) 0%, ${theme.palette.background.paper} 100%)`
            : `linear-gradient(135deg, rgba(3, 199, 90, 0.04) 0%, rgba(255, 255, 255, 0.98) 100%)`,
          boxShadow: '0 2px 12px rgba(3, 199, 90, 0.08)',
        }}
      >
        {/* 상단 네이버 그린 강조 바 */}
        <Box
          sx={{
            height: 3,
            background: 'linear-gradient(90deg, #03C75A 0%, #00A344 50%, #03C75A 100%)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 3s ease-in-out infinite`,
          }}
        />

        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* 메인 컨텐츠 - 가로 레이아웃 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            {/* 네이버 아이콘 */}
            <Box
              sx={{
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <Avatar
                sx={{
                  width: 52,
                  height: 52,
                  background: 'linear-gradient(135deg, #03C75A 0%, #00A344 100%)',
                  boxShadow: '0 4px 14px rgba(3, 199, 90, 0.3)',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                N
              </Avatar>
              {/* 반짝이 효과 */}
              <AutoAwesome
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  fontSize: 16,
                  color: '#F59E0B',
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />
            </Box>

            {/* 텍스트 영역 */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'text.primary',
                  }}
                >
                  네이버 계정 연동
                </Typography>
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: '#03C75A',
                    backgroundColor: 'rgba(3, 199, 90, 0.1)',
                    border: '1px solid rgba(3, 199, 90, 0.2)',
                  }}
                >
                  필수
                </Box>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                }}
              >
                네이버 계정을 연동하면 카페 자동 게시, 스케줄 포스팅 등 모든 기능을 사용할 수 있습니다
              </Typography>
            </Box>

            {/* CTA 버튼 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexShrink: 0,
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              <Button
                variant="contained"
                onClick={() => router.push('/settings')}
                endIcon={<ArrowForward />}
                sx={{
                  flex: { xs: 1, sm: 'none' },
                  minWidth: { sm: 140 },
                  py: 1.25,
                  px: 2.5,
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #03C75A 0%, #00A344 100%)',
                  boxShadow: '0 4px 12px rgba(3, 199, 90, 0.35)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #02B350 0%, #009040 100%)',
                    boxShadow: '0 6px 16px rgba(3, 199, 90, 0.45)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                연동하기
              </Button>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.disabled',
                  fontSize: '0.7rem',
                  display: { xs: 'none', sm: 'block' },
                  whiteSpace: 'nowrap',
                }}
              >
                약 2분 소요
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  }

  // WARNING / ACTION_REQUIRED 상태 - 컴팩트 디자인
  const Icon = config.icon;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 2,
        backgroundColor: config.bgColor,
        border: '1px solid',
        borderColor: config.borderColor,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
        }}
      >
        {/* 아이콘 */}
        <Avatar
          sx={{
            width: 48,
            height: 48,
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <Icon sx={{ color: config.iconColor, fontSize: 28 }} />
        </Avatar>

        {/* 텍스트 영역 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h3"
            sx={{
              color: config.textColor,
              fontWeight: 600,
              mb: 0.5,
            }}
          >
            {config.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: config.textColor,
              opacity: 0.85,
            }}
          >
            {statusReason}
          </Typography>

          {/* 계정 정보 (연결된 경우) */}
          {account && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mt: 1,
                color: config.textColor,
                opacity: 0.7,
              }}
            >
              연동 계정: {account.loginId}
              {session?.naverNickname && ` (${session.naverNickname})`}
            </Typography>
          )}
        </Box>

        {/* 액션 버튼 */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            justifyContent: { xs: 'flex-end', sm: 'flex-start' },
            mt: { xs: 1, sm: 0 },
          }}
        >
          {status === 'WARNING' && (
            <Button
              variant="contained"
              size="medium"
              onClick={onVerify}
              startIcon={<Refresh />}
              sx={{
                backgroundColor: config.iconColor,
                '&:hover': { backgroundColor: '#D97706' },
              }}
            >
              상태 확인
            </Button>
          )}

          {status === 'ACTION_REQUIRED' && (
            <>
              <Button
                variant="contained"
                size="medium"
                onClick={onReconnect}
                startIcon={<Refresh />}
                sx={{
                  backgroundColor: config.iconColor,
                  '&:hover': { backgroundColor: '#DC2626' },
                }}
              >
                지금 재연동
              </Button>
              <Button
                variant="outlined"
                size="medium"
                onClick={() => router.push('/settings')}
                sx={{
                  borderColor: config.borderColor,
                  color: config.textColor,
                  '&:hover': {
                    borderColor: config.iconColor,
                    backgroundColor: 'rgba(0,0,0,0.02)',
                  },
                }}
              >
                설정 보기
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Paper>
  );
}



