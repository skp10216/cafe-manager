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
  Rocket,
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

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(37, 99, 235, 0.3); }
  50% { box-shadow: 0 0 40px rgba(37, 99, 235, 0.5); }
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
    show: false, // 정상일 때는 배너 미표시
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

  // 정상 상태면 배너 미표시
  if (!config.show) {
    return null;
  }

  // NOT_CONNECTED 상태 (미연동) - 프리미엄 하이라이트 디자인
  if (status === 'NOT_CONNECTED') {
    return (
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          border: '2px solid',
          borderColor: 'primary.main',
          animation: `${glow} 3s ease-in-out infinite`,
          // 그라데이션 배경
          background: `linear-gradient(135deg, 
            rgba(37, 99, 235, 0.03) 0%, 
            rgba(99, 102, 241, 0.06) 50%, 
            rgba(139, 92, 246, 0.03) 100%)`,
        }}
      >
        {/* 상단 강조 바 */}
        <Box
          sx={{
            height: 4,
            background: 'linear-gradient(90deg, #2563EB 0%, #6366F1 50%, #8B5CF6 100%)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 3s ease-in-out infinite`,
          }}
        />

        <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {/* 메인 컨텐츠 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: { xs: 2, sm: 3 },
              flexWrap: { xs: 'wrap', md: 'nowrap' },
            }}
          >
            {/* 아이콘 영역 */}
            <Box
              sx={{
                position: 'relative',
                flexShrink: 0,
                animation: `${float} 3s ease-in-out infinite`,
              }}
            >
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                  boxShadow: '0 8px 24px rgba(37, 99, 235, 0.3)',
                }}
              >
                <Rocket sx={{ color: 'white', fontSize: 32 }} />
              </Avatar>
              {/* 반짝이 효과 */}
              <AutoAwesome
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  fontSize: 20,
                  color: '#F59E0B',
                  animation: `${pulse} 2s ease-in-out infinite`,
                }}
              />
            </Box>

            {/* 텍스트 영역 */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* 뱃지 */}
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  mb: 1.5,
                  borderRadius: 2,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'primary.main',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                }}
              >
                <AutoAwesome sx={{ fontSize: 14 }} />
                시작하기
              </Box>

              <Typography
                variant="h2"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.25rem', sm: '1.5rem' },
                  background: 'linear-gradient(135deg, #1E293B 0%, #2563EB 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                }}
              >
                네이버 카페 연동을 시작하세요
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  mb: 2,
                  lineHeight: 1.7,
                  maxWidth: 480,
                }}
              >
                네이버 계정을 연동하면 카페 자동 게시, 스케줄 포스팅,
                게시글 관리 등 모든 기능을 사용할 수 있습니다.
              </Typography>

              {/* 단계 안내 */}
              <Box
                sx={{
                  display: 'flex',
                  gap: { xs: 2, sm: 3 },
                  flexWrap: 'wrap',
                  mb: { xs: 2, md: 0 },
                }}
              >
                {[
                  { num: 1, text: '네이버 로그인' },
                  { num: 2, text: '카페 선택' },
                  { num: 3, text: '자동 게시 시작' },
                ].map((step) => (
                  <Box
                    key={step.num}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 'primary.main',
                        color: 'white',
                      }}
                    >
                      {step.num}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 500, color: 'text.primary' }}
                    >
                      {step.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* CTA 버튼 영역 */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                width: { xs: '100%', md: 'auto' },
                alignItems: { xs: 'stretch', md: 'flex-end' },
              }}
            >
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push('/settings')}
                endIcon={<ArrowForward />}
                sx={{
                  minWidth: 180,
                  py: 1.5,
                  px: 3,
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1D4ED8 0%, #4338CA 100%)',
                    boxShadow: '0 6px 20px rgba(37, 99, 235, 0.5)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                지금 연동하기
              </Button>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textAlign: { xs: 'center', md: 'right' },
                }}
              >
                약 2분 소요 · 무료
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
