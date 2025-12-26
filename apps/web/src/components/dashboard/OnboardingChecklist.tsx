'use client';

/**
 * Onboarding 체크리스트 컴포넌트 - Premium Edition
 * 네이버 연동 → 템플릿 → 스케줄 3단계 가이드
 * 프리미엄 B2B SaaS 스타일 UI - 3열 카드 레이아웃
 */

import {
  Box,
  Typography,
  Button,
  alpha,
  IconButton,
  keyframes,
} from '@mui/material';
import {
  Link as LinkIcon,
  Description,
  Schedule,
  CheckCircle,
  ArrowForward,
  Close,
  WarningAmber,
  RocketLaunch,
  AutoAwesome,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

// 애니메이션 정의
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

/** 체크리스트 상태 */
export interface OnboardingStatus {
  naverConnected: boolean;
  hasTemplate: boolean;
  hasSchedule: boolean;
  sessionStatus?: 'HEALTHY' | 'EXPIRING' | 'EXPIRED' | 'CHALLENGE_REQUIRED' | 'ERROR' | null;
}

interface OnboardingChecklistProps {
  status: OnboardingStatus;
  onDismiss?: () => void;
}

/** 단계 정보 */
const STEPS = [
  {
    key: 'naver',
    label: '네이버 연동',
    description: '네이버 계정을 연동하여 자동 포스팅을 준비합니다',
    icon: LinkIcon,
    href: '/settings',
    ctaText: '연동하기',
    gradient: 'linear-gradient(135deg, #03C75A 0%, #00A344 100%)',
    lightBg: 'rgba(3, 199, 90, 0.06)',
  },
  {
    key: 'template',
    label: '템플릿 생성',
    description: '게시글 템플릿을 만들어 반복 작성을 자동화합니다',
    icon: Description,
    href: '/templates/new',
    ctaText: '만들기',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    lightBg: 'rgba(99, 102, 241, 0.06)',
  },
  {
    key: 'schedule',
    label: '스케줄 설정',
    description: '원하는 시간에 자동으로 게시글이 올라가도록 설정합니다',
    icon: Schedule,
    href: '/schedules/new',
    ctaText: '설정하기',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    lightBg: 'rgba(245, 158, 11, 0.06)',
  },
];

export default function OnboardingChecklist({
  status,
  onDismiss,
}: OnboardingChecklistProps) {
  const router = useRouter();

  // 완료된 단계 수 계산
  const completedSteps = [
    status.naverConnected,
    status.hasTemplate,
    status.hasSchedule,
  ].filter(Boolean).length;

  // 모든 단계 완료 시 숨김
  const isAllComplete = completedSteps === 3;

  // 세션 상태 경고
  const sessionWarning =
    status.naverConnected &&
    status.sessionStatus &&
    !['HEALTHY', 'EXPIRING'].includes(status.sessionStatus);

  // 세션 경고 텍스트
  const getSessionWarningText = () => {
    if (status.sessionStatus === 'EXPIRED') return '세션이 만료되었습니다';
    if (status.sessionStatus === 'CHALLENGE_REQUIRED') return '추가 인증이 필요합니다';
    return '연동 상태를 확인해 주세요';
  };

  if (isAllComplete && !sessionWarning) {
    return null;
  }

  // 각 단계의 완료 상태
  const stepStatus = [
    status.naverConnected,
    status.hasTemplate,
    status.hasSchedule,
  ];

  // 진행률 계산
  const progressPercent = (completedSteps / 3) * 100;

  return (
    <Box
      sx={{
        mb: 3,
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        // 프리미엄 배경
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`
            : `linear-gradient(180deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%)`,
        border: '1px solid',
        borderColor: (theme) =>
          sessionWarning
            ? alpha(theme.palette.warning.main, 0.3)
            : alpha(theme.palette.divider, 0.5),
        boxShadow: (theme) =>
          `0 4px 20px ${alpha(theme.palette.common.black, 0.04)}`,
      }}
    >
      {/* 상단 프로그레스 바 - 그라데이션 */}
      <Box
        sx={{
          height: 4,
          bgcolor: (theme) => alpha(theme.palette.divider, 0.3),
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #03C75A 0%, #6366F1 50%, #F59E0B 100%)',
            backgroundSize: '200% 100%',
            animation: `${shimmer} 2s ease-in-out infinite`,
            transition: 'width 0.6s ease-out',
          }}
        />
      </Box>

      {/* 메인 컨텐츠 */}
      <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
        {/* 헤더 영역 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* 아이콘 */}
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: sessionWarning
                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                  : 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
                boxShadow: sessionWarning
                  ? '0 4px 14px rgba(245, 158, 11, 0.35)'
                  : '0 4px 14px rgba(37, 99, 235, 0.35)',
                position: 'relative',
              }}
            >
              {sessionWarning ? (
                <WarningAmber sx={{ fontSize: 24, color: 'white' }} />
              ) : (
                <RocketLaunch sx={{ fontSize: 24, color: 'white' }} />
              )}
              {!sessionWarning && completedSteps === 0 && (
                <AutoAwesome
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    fontSize: 18,
                    color: '#F59E0B',
                    animation: `${pulse} 2s ease-in-out infinite`,
                  }}
                />
              )}
            </Box>
            
            <Box>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  fontSize: '1.125rem',
                  color: sessionWarning ? 'warning.dark' : 'text.primary',
                  mb: 0.25,
                }}
              >
                {sessionWarning ? '연동 상태 확인 필요' : '시작하기'}
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                }}
              >
                {sessionWarning
                  ? getSessionWarningText()
                  : completedSteps === 0
                  ? '3단계만 완료하면 자동화가 시작됩니다'
                  : `${completedSteps}/3 단계 완료 · ${3 - completedSteps}단계 남음`}
              </Typography>
            </Box>
          </Box>

          {/* 닫기 버튼 */}
          {onDismiss && (
            <IconButton
              size="small"
              onClick={onDismiss}
              sx={{
                color: 'text.disabled',
                transition: 'all 0.2s',
                '&:hover': {
                  color: 'text.secondary',
                  bgcolor: (theme) => alpha(theme.palette.action.hover, 0.8),
                },
              }}
            >
              <Close sx={{ fontSize: 20 }} />
            </IconButton>
          )}
        </Box>

        {/* 3열 카드 레이아웃 */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {STEPS.map((step, index) => {
            const isComplete = stepStatus[index];
            const isDisabled =
              (index === 1 && !status.naverConnected) ||
              (index === 2 && !status.hasTemplate);
            const isActive = !isComplete && !isDisabled;
            const showWarning = index === 0 && sessionWarning;
            const StepIcon = step.icon;

            return (
              <Box
                key={step.key}
                sx={{
                  position: 'relative',
                  p: 2.5,
                  borderRadius: 2.5,
                  bgcolor: (theme) =>
                    isComplete
                      ? alpha(theme.palette.success.main, 0.04)
                      : showWarning
                      ? alpha(theme.palette.warning.main, 0.04)
                      : isActive
                      ? step.lightBg
                      : alpha(theme.palette.grey[100], 0.5),
                  border: '1px solid',
                  borderColor: (theme) =>
                    isComplete
                      ? alpha(theme.palette.success.main, 0.2)
                      : showWarning
                      ? alpha(theme.palette.warning.main, 0.25)
                      : isActive
                      ? alpha(theme.palette.primary.main, 0.12)
                      : alpha(theme.palette.divider, 0.5),
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: isActive || showWarning ? 'pointer' : 'default',
                  // 호버 효과
                  ...(isActive && {
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: (theme) =>
                        `0 12px 28px ${alpha(theme.palette.primary.main, 0.15)}`,
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                      '& .step-cta': {
                        background: step.gradient,
                        color: 'white',
                        borderColor: 'transparent',
                      },
                    },
                  }),
                  ...(showWarning && {
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: (theme) =>
                        `0 12px 28px ${alpha(theme.palette.warning.main, 0.2)}`,
                    },
                  }),
                }}
                onClick={() => {
                  if (isActive || showWarning) {
                    router.push(step.href);
                  }
                }}
              >
                {/* 단계 번호 뱃지 */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: isComplete
                      ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                      : showWarning
                      ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                      : isActive
                      ? step.gradient
                      : (theme) => alpha(theme.palette.grey[400], 0.2),
                    color: isComplete || showWarning || isActive ? 'white' : 'grey.500',
                    boxShadow: (isComplete || isActive) && !isDisabled
                      ? '0 2px 8px rgba(0,0,0,0.15)'
                      : 'none',
                  }}
                >
                  {isComplete ? (
                    <CheckCircle sx={{ fontSize: 16 }} />
                  ) : showWarning ? (
                    <WarningAmber sx={{ fontSize: 14 }} />
                  ) : (
                    index + 1
                  )}
                </Box>

                {/* 아이콘 */}
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    background: isComplete
                      ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                      : showWarning
                      ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                      : isActive
                      ? step.gradient
                      : (theme) => alpha(theme.palette.grey[200], 0.8),
                    boxShadow: isComplete || isActive
                      ? '0 4px 12px rgba(0,0,0,0.12)'
                      : 'none',
                    transition: 'all 0.3s',
                  }}
                >
                  {isComplete ? (
                    <CheckCircle sx={{ fontSize: 26, color: 'white' }} />
                  ) : showWarning ? (
                    <WarningAmber sx={{ fontSize: 24, color: 'white' }} />
                  ) : (
                    <StepIcon
                      sx={{
                        fontSize: 24,
                        color: isActive ? 'white' : 'grey.400',
                      }}
                    />
                  )}
                </Box>

                {/* 라벨 */}
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    mb: 0.75,
                    color: isComplete
                      ? 'success.dark'
                      : showWarning
                      ? 'warning.dark'
                      : isActive
                      ? 'text.primary'
                      : 'grey.500',
                  }}
                >
                  {step.label}
                </Typography>

                {/* 설명 */}
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    color: isComplete
                      ? 'success.main'
                      : showWarning
                      ? 'warning.main'
                      : isDisabled
                      ? 'grey.400'
                      : 'text.secondary',
                    mb: isActive || showWarning ? 2.5 : 0,
                    minHeight: isActive || showWarning ? 'auto' : 40,
                  }}
                >
                  {isComplete
                    ? '✓ 완료됨'
                    : showWarning
                    ? getSessionWarningText()
                    : isDisabled
                    ? '이전 단계를 먼저 완료해 주세요'
                    : step.description}
                </Typography>

                {/* CTA 버튼 */}
                {(isActive || showWarning) && (
                  <Button
                    className="step-cta"
                    fullWidth
                    variant="outlined"
                    color={showWarning ? 'warning' : 'primary'}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(step.href);
                    }}
                    endIcon={<ArrowForward sx={{ fontSize: 18 }} />}
                    sx={{
                      py: 1.25,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: 'none',
                      transition: 'all 0.25s ease',
                      borderWidth: 1.5,
                    }}
                  >
                    {showWarning ? '확인하기' : step.ctaText}
                  </Button>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

