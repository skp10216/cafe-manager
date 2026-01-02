'use client';

/**
 * 상태 요약 헤더 - 프리미엄 v2
 * 
 * Linear/Notion 스타일 콘솔 감성:
 * - 타이포그래피 토큰 적용
 * - tabular-nums로 숫자 정렬
 * - 담백하고 전문적인 UI
 */

import { Box, Typography, Skeleton, Avatar, alpha, Tooltip, IconButton, LinearProgress, Chip } from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Schedule,
  Settings,
  Refresh,
  PlayCircle,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { Clock } from '@/components/common/Clock';
import {
  JobSummaryResponse,
  ActiveRunResponse,
  IntegrationStatusResponse,
} from '@/lib/api-client';
import { typography, colors, monoFontFamily } from '@/lib/typography';

interface StatusSummaryHeaderProps {
  integration: IntegrationStatusResponse | null;
  jobSummary: JobSummaryResponse | null;
  activeRun: ActiveRunResponse | null;
  multiRunSummary?: {
    runningCount: number;
    totalProcessed: number;
    totalTarget: number;
    totalSuccess: number;
    totalFailed: number;
    schedules?: Array<{
      name: string;
      processed: number;
      total: number;
      failed: number;
    }>;
  } | null;
  loading?: boolean;
  onReconnect?: () => void;
  onVerify?: () => void;
}

interface StatusInfo {
  icon: typeof CheckCircle;
  color: string;
  message: string;
  subMessage: string | null;
  animate?: boolean;
}

export default function StatusSummaryHeader({
  integration,
  jobSummary,
  activeRun,
  multiRunSummary,
  loading = false,
  onReconnect,
  onVerify,
}: StatusSummaryHeaderProps) {
  const router = useRouter();

  const getStatusInfo = (): StatusInfo => {
    // 복수 실행
    if (multiRunSummary && multiRunSummary.runningCount > 0) {
      const { runningCount, totalProcessed, totalTarget, totalFailed } = multiRunSummary;
      const progress = totalTarget > 0 ? Math.round((totalProcessed / totalTarget) * 100) : 0;
      
      if (totalFailed > 0) {
        return {
          icon: PlayCircle,
          color: colors.warning,
          message: `${runningCount}개 스케줄 실행 중`,
          subMessage: `진행 ${totalProcessed}/${totalTarget} (${progress}%) · 실패 ${totalFailed}건`,
          animate: true,
        };
      }
      
      return {
        icon: PlayCircle,
        color: colors.running,
        message: `${runningCount}개 스케줄 실행 중`,
        subMessage: `진행 ${totalProcessed}/${totalTarget} (${progress}%)`,
        animate: true,
      };
    }

    // 단일 실행
    if (activeRun?.run) {
      const { scheduleName, processedCount, totalTarget, failedCount } = activeRun.run;
      const progress = totalTarget > 0 ? Math.round((processedCount / totalTarget) * 100) : 0;
      
      if (failedCount > 0) {
        return {
          icon: PlayCircle,
          color: colors.warning,
          message: `스케줄 실행 중: ${scheduleName}`,
          subMessage: `진행 ${processedCount}/${totalTarget} (${progress}%) · 실패 ${failedCount}건`,
          animate: true,
        };
      }
      
      return {
        icon: PlayCircle,
        color: colors.running,
        message: `스케줄 실행 중: ${scheduleName}`,
        subMessage: `진행 ${processedCount}/${totalTarget} (${progress}%)`,
        animate: true,
      };
    }

    // 연동 문제
    if (integration?.status === 'ACTION_REQUIRED') {
      return {
        icon: ErrorIcon,
        color: colors.error,
        message: '네이버 연동에 문제가 있습니다',
        subMessage: integration.statusReason,
      };
    }

    if (integration?.status === 'WARNING') {
      return {
        icon: Warning,
        color: colors.warning,
        message: '연동 상태 확인이 필요합니다',
        subMessage: integration.statusReason,
      };
    }

    // 오늘 실패
    const failedToday = jobSummary?.today?.failed ?? 0;
    if (failedToday > 0) {
      return {
        icon: Warning,
        color: colors.warning,
        message: `오늘 실패 ${failedToday}건 발생`,
        subMessage: '로그에서 원인을 확인해주세요',
      };
    }

    // 정상 상태
    const completedToday = jobSummary?.today?.completed ?? 0;
    if (completedToday > 0) {
      const totalToday = jobSummary?.today?.total ?? 0;
      const successRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 100;
      
      return {
        icon: CheckCircle,
        color: colors.success,
        message: '현재 자동화 정상 동작 중입니다',
        subMessage: `오늘 ${completedToday}건 성공 (성공률 ${successRate}%)`,
      };
    }

    // 연동 필요
    if (integration?.status === 'NOT_CONNECTED') {
      return {
        icon: Schedule,
        color: colors.queued,
        message: '네이버 계정을 연동해주세요',
        subMessage: '연동 후 자동 게시를 시작할 수 있습니다',
      };
    }

    return {
      icon: Schedule,
      color: colors.queued,
      message: '대기 중',
      subMessage: '예정된 스케줄이 실행되면 여기에 표시됩니다',
    };
  };

  const getNaverBadgeInfo = () => {
    if (!integration || integration.status === 'NOT_CONNECTED') {
      return { color: colors.queued, text: '미연동', show: false };
    }
    if (integration.status === 'OK') {
      return { color: colors.success, text: '정상', show: true };
    }
    if (integration.status === 'WARNING') {
      return { color: colors.warning, text: '주의', show: true };
    }
    if (integration.status === 'ACTION_REQUIRED') {
      return { color: colors.error, text: '조치필요', show: true };
    }
    return { color: colors.queued, text: '확인중', show: true };
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          mb: 2.5,
          pb: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2 }} />
          <Box>
            <Skeleton width={200} height={24} />
            <Skeleton width={140} height={18} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
        <Skeleton variant="rounded" width={200} height={44} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  const status = getStatusInfo();
  const StatusIcon = status.icon;
  const naverBadge = getNaverBadgeInfo();
  const isRunning = multiRunSummary?.runningCount && multiRunSummary.runningCount > 0;
  const progress = multiRunSummary && multiRunSummary.totalTarget > 0 
    ? Math.round((multiRunSummary.totalProcessed / multiRunSummary.totalTarget) * 100) 
    : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mb: 2.5,
        pb: 2.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* 왼쪽: 상태 요약 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 280 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            backgroundColor: alpha(status.color, 0.06),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid',
            borderColor: alpha(status.color, 0.2),
          }}
        >
          <StatusIcon
            sx={{
              fontSize: 22,
              color: status.color,
              animation: status.animate ? 'spin 2s linear infinite' : 'none',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
        </Box>
        
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              ...typography.sectionTitle,
              fontSize: { xs: '1rem', sm: '1.1rem' },
              color: status.color,
            }}
          >
            {status.message}
          </Typography>
          {status.subMessage && (
            <Typography sx={{ ...typography.helper, mt: 0.25, fontFamily: monoFontFamily }}>
              {status.subMessage}
            </Typography>
          )}
          
          {isRunning && multiRunSummary && (
            <Box sx={{ mt: 1.25 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: alpha(status.color, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 2.5,
                    backgroundColor: status.color,
                  },
                }}
              />
              
              {multiRunSummary.schedules && multiRunSummary.schedules.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
                  {multiRunSummary.schedules.slice(0, 3).map((schedule, idx) => {
                    const hasFailed = schedule.failed > 0;
                    
                    return (
                      <Chip
                        key={idx}
                        size="small"
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                backgroundColor: hasFailed ? colors.warning : colors.running,
                                animation: 'pulse 1.5s ease-in-out infinite',
                                '@keyframes pulse': {
                                  '0%, 100%': { opacity: 1 },
                                  '50%': { opacity: 0.35 },
                                },
                              }}
                            />
                            <Typography
                              component="span"
                              sx={{
                                maxWidth: 70,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                ...typography.chip,
                              }}
                            >
                              {schedule.name}
                            </Typography>
                            <Typography
                              component="span"
                              sx={{
                                ...typography.chip,
                                fontFamily: monoFontFamily,
                                fontWeight: 700,
                              }}
                            >
                              {schedule.processed}/{schedule.total}
                            </Typography>
                          </Box>
                        }
                        sx={{
                          height: 22,
                          backgroundColor: hasFailed 
                            ? alpha(colors.warning, 0.08)
                            : alpha(colors.running, 0.06),
                          color: hasFailed ? colors.warning : colors.running,
                          border: '1px solid',
                          borderColor: hasFailed 
                            ? alpha(colors.warning, 0.2)
                            : alpha(colors.running, 0.15),
                        }}
                      />
                    );
                  })}
                  {multiRunSummary.schedules.length > 3 && (
                    <Chip
                      size="small"
                      label={`+${multiRunSummary.schedules.length - 3}개`}
                      sx={{
                        height: 22,
                        ...typography.chip,
                        backgroundColor: alpha('#000', 0.03),
                        color: 'text.secondary',
                      }}
                    />
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* 오른쪽: 네이버 연동 + 시계 */}
      <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 1.25, flexShrink: 0 }}>
        {naverBadge.show && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              border: '1px solid',
              borderColor: alpha(naverBadge.color, 0.2),
              backgroundColor: alpha(naverBadge.color, 0.03),
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  background: 'linear-gradient(135deg, #03C75A 0%, #00A344 100%)',
                  ...typography.chip,
                  fontWeight: 800,
                }}
              >
                N
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: naverBadge.color,
                  border: '2px solid white',
                }}
              />
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ ...typography.cardTitle, fontSize: '0.75rem', lineHeight: 1.2 }}>
                  {integration?.account?.loginId || '네이버'}
                </Typography>
                <Box
                  sx={{
                    px: 0.5,
                    py: 0.125,
                    borderRadius: 0.75,
                    ...typography.chip,
                    fontSize: '0.55rem',
                    color: naverBadge.color,
                    backgroundColor: alpha(naverBadge.color, 0.1),
                    lineHeight: 1.3,
                  }}
                >
                  {naverBadge.text}
                </Box>
              </Box>
              {integration?.session?.naverNickname && (
                <Typography
                  sx={{ ...typography.helper, fontSize: '0.65rem', lineHeight: 1.2, mt: 0.125 }}
                  noWrap
                >
                  {integration.session.naverNickname}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.25 }}>
              {integration?.status === 'ACTION_REQUIRED' && onReconnect && (
                <Tooltip title="재연동">
                  <IconButton
                    size="small"
                    onClick={onReconnect}
                    sx={{
                      width: 26,
                      height: 26,
                      color: naverBadge.color,
                      '&:hover': { backgroundColor: alpha(naverBadge.color, 0.1) },
                    }}
                  >
                    <Refresh sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="설정">
                <IconButton
                  size="small"
                  onClick={() => router.push('/settings')}
                  sx={{
                    width: 26,
                    height: 26,
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: alpha('#000', 0.04) },
                  }}
                >
                  <Settings sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        )}

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Clock variant="full" />
        </Box>
      </Box>
    </Box>
  );
}
