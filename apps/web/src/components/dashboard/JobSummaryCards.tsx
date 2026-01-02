'use client';

/**
 * 오늘 작업 현황 통합 컴포넌트 - Premium Edition v5
 * 
 * 통합 영역:
 * - KPI 카드 (성공/실패)
 * - 최근 결과 리스트
 * - 운영 상태 (실패 분석)
 * 
 * 개선 사항:
 * - 접기/펼치기 가능한 컨테이너 구조
 * - 실행 모니터와 동일한 UI 패턴
 * - 모든 관련 정보를 하나의 컨테이너에 통합
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Skeleton,
  alpha,
  Stack,
  Collapse,
  IconButton,
  Tooltip,
  Grid,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  TrendingUp,
  ExpandMore,
  ExpandLess,
  ListAlt,
  Analytics,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { typography, colors } from '@/lib/typography';
import RecentResultsList, { RecentResultItem } from './RecentResultsList';
import FailureSummary, { FailureCategoryItem } from './FailureSummary';

/** 접힘 상태 저장 키 */
const COLLAPSE_STORAGE_KEY = 'jobSummaryCards_collapsed';

/** 카드 데이터 타입 */
interface CardData {
  count: number;
  recent: { id: string; name: string; status: string; time: string }[];
}

/** 작업 요약 데이터 */
interface JobSummaryData {
  today: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
  };
  cards: {
    todayJobs: CardData;
    completed: CardData;
    failed: CardData;
    processing: CardData;
  };
}

/** 최근 결과 데이터 */
interface RecentResultsData {
  items: RecentResultItem[];
  total: number;
}

/** 실패 분석 데이터 */
interface FailureSummaryData {
  topCategories: FailureCategoryItem[];
  totalFailures: number;
  period: 'TODAY' | 'WEEK';
}

interface JobSummaryCardsProps {
  /** 작업 요약 데이터 */
  data: JobSummaryData | null;
  /** 최근 결과 데이터 */
  recentResults?: RecentResultsData | null;
  /** 실패 분석 데이터 */
  failureSummary?: FailureSummaryData | null;
  /** 로딩 상태 */
  loading?: boolean;
  /** 최근 결과 로딩 상태 */
  recentResultsLoading?: boolean;
  /** 실패 분석 로딩 상태 */
  failureSummaryLoading?: boolean;
  /** Job 클릭 핸들러 */
  onJobClick?: (jobId: string) => void;
  /** 재시도 핸들러 */
  onRetry?: (jobId: string) => void;
  /** 로그 보기 핸들러 */
  onViewLog?: (jobId: string) => void;
  /** 결과 필터 변경 핸들러 */
  onResultFilterChange?: (filter: 'ALL' | 'SUCCESS' | 'FAILED') => void;
  /** 기본 펼침 상태 (true면 펼침 우선, localStorage 무시) */
  defaultExpanded?: boolean;
}

/**
 * 내부 섹션 헤더
 */
function InnerSectionHeader({
  icon: Icon,
  title,
  badge,
  badgeColor = 'primary',
  extra,
}: {
  icon: typeof ListAlt;
  title: string;
  badge?: number;
  badgeColor?: 'primary' | 'success' | 'error' | 'warning';
  extra?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: alpha('#10B981', 0.1),
        backgroundColor: alpha('#10B981', 0.02),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon sx={{ fontSize: 18, color: '#10B981' }} />
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary' }}>
          {title}
        </Typography>
        {badge !== undefined && badge > 0 && (
          <Box
            sx={{
              px: 0.875,
              py: 0.125,
              borderRadius: 1.25,
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: alpha(
                badgeColor === 'success' ? '#10B981' :
                badgeColor === 'error' ? '#EF4444' :
                badgeColor === 'warning' ? '#F59E0B' : '#10B981',
                0.12
              ),
              color: 
                badgeColor === 'success' ? '#10B981' :
                badgeColor === 'error' ? '#EF4444' :
                badgeColor === 'warning' ? '#F59E0B' : '#10B981',
            }}
          >
            {badge}
          </Box>
        )}
      </Box>
      {extra}
    </Box>
  );
}

/**
 * KPI 카드 (내부용)
 */
function KPICard({
  label,
  count,
  color,
  icon: Icon,
  subText,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  icon: typeof CheckCircle;
  subText?: string;
  onClick?: () => void;
}) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        flex: 1,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(color, 0.15),
        backgroundColor: alpha(color, 0.02),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: color,
        },
        '&:hover': onClick ? {
          borderColor: alpha(color, 0.3),
          backgroundColor: alpha(color, 0.04),
          transform: 'translateY(-1px)',
          boxShadow: `0 4px 12px ${alpha(color, 0.08)}`,
        } : {},
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ ...typography.label, color, mb: 0.5, fontSize: '0.75rem' }}>
            {label}
          </Typography>
          <Typography
            sx={{
              ...typography.kpiNumber,
              fontSize: '1.75rem',
              color,
            }}
          >
            {count}
            <Typography
              component="span"
              sx={{ ...typography.helper, ml: 0.5, color: alpha(color, 0.7), fontSize: '0.75rem' }}
            >
              건
            </Typography>
          </Typography>
          {subText && (
            <Typography sx={{ ...typography.helper, mt: 0.5, color, fontSize: '0.7rem' }}>
              {subText}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(color, 0.1),
          }}
        >
          <Icon sx={{ fontSize: 20, color }} />
        </Box>
      </Box>
    </Paper>
  );
}

/**
 * 로딩 스켈레톤
 */
function LoadingSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: alpha('#10B981', 0.25),
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Skeleton variant="rounded" height={90} sx={{ flex: 1, borderRadius: 2 }} />
            <Skeleton variant="rounded" height={90} sx={{ flex: 1, borderRadius: 2 }} />
          </Stack>
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
        </Stack>
      </Box>
    </Paper>
  );
}

export default function JobSummaryCards({
  data,
  recentResults,
  failureSummary,
  loading = false,
  recentResultsLoading = false,
  failureSummaryLoading = false,
  onJobClick,
  onRetry,
  onViewLog,
  onResultFilterChange,
  defaultExpanded,
}: JobSummaryCardsProps) {
  const router = useRouter();

  // 접힘 상태 (localStorage 연동)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // localStorage에서 접힘 상태 복원 (defaultExpanded가 true면 무조건 펼침)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // defaultExpanded가 true면 펼침 상태로 강제 설정
      if (defaultExpanded === true) {
        setIsCollapsed(false);
        localStorage.setItem(COLLAPSE_STORAGE_KEY, 'false');
        return;
      }
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    }
  }, [defaultExpanded]);

  // 접힘 상태 토글
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  const handleCardClick = (filterParam: string) => {
    const url = filterParam ? `/logs?${filterParam}` : '/logs';
    router.push(url);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  const completedCount = data?.cards.completed?.count ?? 0;
  const failedCount = data?.cards.failed?.count ?? 0;
  const totalToday = data?.today?.total ?? 0;
  const processingCount = data?.today?.processing ?? 0;

  const failedColor = failedCount > 0 ? colors.error : colors.success;
  const hasActivity = totalToday > 0;

  // 최근 결과 데이터
  const recentItems = recentResults?.items ?? [];
  const recentTotal = recentResults?.total ?? 0;

  // 실패 분석 데이터
  const topCategories = failureSummary?.topCategories ?? [];
  const totalFailures = failureSummary?.totalFailures ?? 0;
  const failurePeriod = failureSummary?.period ?? 'TODAY';

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '2px solid',
        borderColor: alpha('#10B981', 0.25),
        overflow: 'hidden',
        backgroundColor: 'background.paper',
      }}
    >
      {/* ========== 헤더 ========== */}
      <Box
        onClick={toggleCollapse}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2,
          cursor: 'pointer',
          backgroundColor: alpha('#10B981', 0.04),
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: alpha('#10B981', 0.15),
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: alpha('#10B981', 0.06),
          },
        }}
      >
        {/* 아이콘 */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            backgroundColor: alpha('#10B981', 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <TrendingUp sx={{ fontSize: 22, color: '#10B981' }} />
        </Box>

        {/* 제목 + 설명 */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>
            오늘 작업 현황
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {hasActivity 
              ? `총 ${totalToday}건${processingCount > 0 ? ` · ${processingCount}건 진행중` : ''}`
              : '오늘 실행된 작업 없음'
            }
          </Typography>
        </Box>

        {/* 상태 배지들 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {completedCount > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                px: 1,
                py: 0.375,
                borderRadius: 1.5,
                backgroundColor: alpha(colors.success, 0.1),
              }}
            >
              <CheckCircle sx={{ fontSize: 14, color: colors.success }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colors.success }}>
                {completedCount}
              </Typography>
            </Box>
          )}
          {failedCount > 0 && (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5,
                px: 1,
                py: 0.375,
                borderRadius: 1.5,
                backgroundColor: alpha(colors.error, 0.1),
              }}
            >
              <ErrorIcon sx={{ fontSize: 14, color: colors.error }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: colors.error }}>
                {failedCount}
              </Typography>
            </Box>
          )}
          {!hasActivity && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', fontWeight: 500 }}>
              대기 중
            </Typography>
          )}
        </Box>

        {/* 접기/펼치기 버튼 */}
        <Tooltip title={isCollapsed ? '펼치기' : '접기'}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse();
            }}
            sx={{
              ml: 0.5,
              width: 32,
              height: 32,
              backgroundColor: alpha('#10B981', 0.08),
              color: '#10B981',
              '&:hover': {
                backgroundColor: alpha('#10B981', 0.15),
              },
            }}
          >
            {isCollapsed ? <ExpandMore /> : <ExpandLess />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ========== 콘텐츠 영역 (접기/펼치기) ========== */}
      <Collapse in={!isCollapsed} timeout={300}>
        <Box sx={{ p: 2 }}>
          {/* KPI 카드들 */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <KPICard
              label="성공 게시"
              count={completedCount}
              color={colors.success}
              icon={CheckCircle}
              onClick={() => handleCardClick('status=COMPLETED')}
            />
            <KPICard
              label="실패"
              count={failedCount}
              color={failedColor}
              icon={failedCount > 0 ? ErrorIcon : CheckCircle}
              subText={failedCount === 0 ? '✨ 오늘 실패 없음' : undefined}
              onClick={() => handleCardClick('status=FAILED')}
            />
          </Stack>

          {/* 최근 결과 & 운영 상태 */}
          <Grid container spacing={2}>
            {/* 최근 결과 */}
            <Grid item xs={12} lg={8}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#10B981', 0.15),
                  overflow: 'hidden',
                  backgroundColor: alpha('#10B981', 0.01),
                }}
              >
                <InnerSectionHeader
                  icon={ListAlt}
                  title="최근 결과"
                  badge={recentTotal > 0 ? recentTotal : undefined}
                />
                <Box sx={{ p: 1.5 }}>
                  <RecentResultsList
                    items={recentItems}
                    total={recentTotal}
                    loading={recentResultsLoading}
                    onRetry={onRetry}
                    onViewLog={onViewLog}
                    onFilterChange={onResultFilterChange}
                    embedded
                  />
                </Box>
              </Paper>
            </Grid>

            {/* 운영 상태 (실패 분석) */}
            <Grid item xs={12} lg={4}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha('#10B981', 0.15),
                  overflow: 'hidden',
                  backgroundColor: alpha('#10B981', 0.01),
                  height: '100%',
                }}
              >
                <InnerSectionHeader
                  icon={Analytics}
                  title="운영 상태"
                  badge={totalFailures > 0 ? totalFailures : undefined}
                  badgeColor={totalFailures > 0 ? 'error' : 'success'}
                />
                <Box sx={{ p: 1.5 }}>
                  <FailureSummary
                    topCategories={topCategories}
                    totalFailures={totalFailures}
                    period={failurePeriod}
                    loading={failureSummaryLoading}
                    onViewJob={onViewLog}
                    embedded
                  />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      {/* 접힌 상태일 때 요약 정보 */}
      {isCollapsed && hasActivity && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: alpha('#10B981', 0.1),
            backgroundColor: alpha('#10B981', 0.02),
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            성공 {completedCount}건 · 실패 {failedCount}건
          </Typography>
          {failedCount === 0 && (
            <Typography sx={{ fontSize: '0.8rem', color: colors.success, fontWeight: 600 }}>
              ✨ 오류 없음
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
}
