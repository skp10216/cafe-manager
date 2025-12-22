'use client';

/**
 * 섹션 B: 작업 현황 카드 컴포넌트
 * 컴팩트 프리미엄 디자인 - 오늘 작업/완료/실패/진행중
 */

import { Box, Typography, Paper, Skeleton, alpha } from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Error as ErrorIcon,
  Sync,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

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

interface JobSummaryCardsProps {
  /** 작업 요약 데이터 */
  data: JobSummaryData | null;
  /** 로딩 상태 */
  loading?: boolean;
  /** 작업 상세 클릭 핸들러 */
  onJobClick?: (jobId: string) => void;
}

/** 카드 타입별 설정 */
const CARD_CONFIG = {
  todayJobs: {
    title: '오늘 작업',
    icon: TrendingUp,
    color: '#2563EB',
    bgColor: '#EFF6FF',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    filterParam: '',
  },
  completed: {
    title: '완료',
    icon: CheckCircle,
    color: '#10B981',
    bgColor: '#ECFDF5',
    gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
    filterParam: 'status=COMPLETED',
  },
  failed: {
    title: '실패',
    icon: ErrorIcon,
    color: '#EF4444',
    bgColor: '#FEF2F2',
    gradient: 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)',
    filterParam: 'status=FAILED',
  },
  processing: {
    title: '진행 중',
    icon: Sync,
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
    filterParam: 'status=PROCESSING',
  },
};

export default function JobSummaryCards({
  data,
  loading = false,
  onJobClick,
}: JobSummaryCardsProps) {
  const router = useRouter();

  // 카드 클릭 → 로그 페이지 이동
  const handleCardClick = (cardType: keyof typeof CARD_CONFIG) => {
    const config = CARD_CONFIG[cardType];
    const url = config.filterParam ? `/logs?${config.filterParam}` : '/logs';
    router.push(url);
  };

  // 로딩 상태
  if (loading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 2,
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Paper
            key={i}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Skeleton variant="rounded" width={36} height={36} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={24} sx={{ mt: 0.5 }} />
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, 1fr)',
          lg: 'repeat(4, 1fr)',
        },
        gap: 2,
      }}
    >
      {(Object.keys(CARD_CONFIG) as Array<keyof typeof CARD_CONFIG>).map((cardType) => {
        const config = CARD_CONFIG[cardType];
        const cardData = data?.cards[cardType];
        const Icon = config.icon;
        const count = cardData?.count ?? 0;

        return (
          <Paper
            key={cardType}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: count > 0 ? alpha(config.color, 0.2) : 'divider',
              backgroundColor: count > 0 ? alpha(config.color, 0.02) : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                borderColor: config.color,
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${alpha(config.color, 0.15)}`,
              },
              '&::before': count > 0 ? {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: config.gradient,
              } : {},
            }}
            onClick={() => handleCardClick(cardType)}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              {/* 아이콘 */}
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: count > 0 ? config.gradient : config.bgColor,
                  boxShadow: count > 0 ? `0 4px 12px ${alpha(config.color, 0.3)}` : 'none',
                  flexShrink: 0,
                }}
              >
                <Icon
                  sx={{
                    fontSize: 22,
                    color: count > 0 ? 'white' : config.color,
                  }}
                />
              </Box>

              {/* 타이틀 + 숫자 */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 500,
                    mb: 0.25,
                  }}
                >
                  {config.title}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    lineHeight: 1.2,
                    color: count > 0 ? config.color : 'text.primary',
                  }}
                >
                  {count}
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'text.secondary',
                      ml: 0.5,
                    }}
                  >
                    건
                  </Typography>
                </Typography>
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
