'use client';

/**
 * 스케줄 목록 페이지 - Premium Edition
 * 프리미엄 B2B SaaS 스타일 UI
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Switch,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  alpha,
  Stack,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  PlayArrow,
  History,
  Lock,
  CheckCircle,
  Warning,
  Error,
  HourglassEmpty,
  Link as LinkIcon,
  Schedule,
  AccessTime,
  Description,
} from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable, { Column } from '@/components/common/AppTable';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { scheduleApi, dashboardApi, Schedule as ScheduleType } from '@/lib/api-client';

/** 실행 상태 뱃지 컴포넌트 */
function ExecutionStatusBadge({
  userEnabled,
  adminStatus,
  sessionHealthy,
}: {
  userEnabled: boolean;
  adminStatus: string;
  sessionHealthy: boolean;
}) {
  const adminApproved = adminStatus === 'APPROVED';
  const canExecute = userEnabled && adminApproved && sessionHealthy;

  if (canExecute) {
    return (
      <Chip
        size="small"
        icon={<CheckCircle sx={{ fontSize: 14 }} />}
        label="실행 가능"
        color="success"
        sx={{
          height: 24,
          fontWeight: 600,
          '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem' },
          '& .MuiChip-icon': { ml: 0.5 },
        }}
      />
    );
  }

  // 문제가 있는 경우
  const issues = [];
  if (!userEnabled) issues.push('비활성화');
  if (!adminApproved) issues.push(adminStatus === 'NEEDS_REVIEW' ? '승인대기' : '관리자중지');
  if (!sessionHealthy) issues.push('연동필요');

  return (
    <Tooltip title={issues.join(' · ')}>
      <Chip
        size="small"
        icon={<Warning sx={{ fontSize: 14 }} />}
        label={issues[0]}
        color="warning"
        sx={{
          height: 24,
          fontWeight: 600,
          '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem' },
          '& .MuiChip-icon': { ml: 0.5 },
        }}
      />
    </Tooltip>
  );
}

export default function SchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleType | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; schedule: ScheduleType } | null>(
    null
  );

  // 세션 상태 (API에서 가져옴)
  const [sessionHealthy, setSessionHealthy] = useState(true);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await scheduleApi.list(page);
      setSchedules(response.data);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('스케줄 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 세션 상태 로드
  const loadSessionStatus = async () => {
    try {
      const integrationStatus = await dashboardApi.getIntegrationStatus();
      const status = integrationStatus.session?.status;
      // HEALTHY 또는 EXPIRING이면 실행 가능
      setSessionHealthy(status === 'HEALTHY' || status === 'EXPIRING');
    } catch (error) {
      console.error('세션 상태 로딩 실패:', error);
      setSessionHealthy(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    loadSessionStatus();
  }, [page]);

  const handleToggle = async (schedule: ScheduleType) => {
    // 관리자 게이트가 APPROVED가 아니면 토글 불가
    if (schedule.adminStatus !== 'APPROVED') {
      alert(
        schedule.adminStatus === 'NEEDS_REVIEW' 
          ? '관리자 승인 대기 중입니다. 승인 후 활성화할 수 있습니다.'
          : `관리자에 의해 ${schedule.adminStatus === 'SUSPENDED' ? '일시 중지' : '차단'}되었습니다.${schedule.adminReason ? `\n사유: ${schedule.adminReason}` : ''}`
      );
      return;
    }

    try {
      const newEnabled = !schedule.userEnabled;
      await scheduleApi.toggleEnabled(schedule.id, newEnabled);
      loadSchedules();
    } catch (error) {
      alert('상태 변경 실패');
    }
  };

  const handleRunNow = async (schedule: ScheduleType) => {
    // 실행 조건 체크
    if (!schedule.userEnabled) {
      alert('스케줄이 비활성화되어 있습니다. 먼저 활성화해주세요.');
      return;
    }
    if (schedule.adminStatus !== 'APPROVED') {
      alert('관리자 승인이 필요합니다.');
      return;
    }
    if (!sessionHealthy) {
      alert('네이버 연동이 필요합니다. 설정에서 연동 상태를 확인해주세요.');
      return;
    }

    try {
      await scheduleApi.runNow(schedule.id);
      alert(`"${schedule.name}" 스케줄이 즉시 실행되었습니다.`);
      loadSchedules();
    } catch (error: any) {
      if (error?.message?.includes('이미 실행되었습니다')) {
        alert('오늘은 이미 실행되어 중복 실행되지 않았습니다.');
      } else {
        alert('즉시 실행 실패: ' + (error?.message || '알 수 없는 오류'));
      }
    } finally {
      setMenuAnchor(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await scheduleApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadSchedules();
    } catch (error) {
      alert('삭제 실패');
    }
  };

  const calculateNextRun = (schedule: ScheduleType): { text: string; isActive: boolean } => {
    // 실행 불가 조건
    if (!schedule.userEnabled) return { text: '-', isActive: false };
    if (schedule.adminStatus !== 'APPROVED') return { text: '-', isActive: false };
    if (!sessionHealthy) return { text: '-', isActive: false };

    try {
      const now = new Date();
      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const isToday = nextRun.getDate() === now.getDate();
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      return {
        text: isToday ? `오늘 ${timeStr}` : `내일 ${timeStr}`,
        isActive: true,
      };
    } catch {
      return { text: '-', isActive: false };
    }
  };

  const columns: Column<ScheduleType>[] = [
    {
      id: 'name',
      label: '스케줄',
      minWidth: 200,
      render: (row: ScheduleType) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              flexShrink: 0,
            }}
          >
            <Schedule sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {row.name}
            </Typography>
            {row.template && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Description sx={{ fontSize: 12 }} />
                {row.template.name}
              </Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      id: 'summary',
      label: '실행 설정',
      minWidth: 180,
      render: (row: ScheduleType) => (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              매일 {row.runTime}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {row.dailyPostCount}개 · {row.postIntervalMinutes}분 간격
          </Typography>
        </Box>
      ),
    },
    {
      id: 'nextRun',
      label: '다음 실행',
      minWidth: 120,
      render: (row: ScheduleType) => {
        const nextRun = calculateNextRun(row);
        return (
          <Typography
            variant="body2"
            sx={{
              fontWeight: nextRun.isActive ? 600 : 400,
              color: nextRun.isActive ? 'primary.main' : 'text.disabled',
            }}
          >
            {nextRun.text}
          </Typography>
        );
      },
    },
    {
      id: 'status',
      label: '상태',
      minWidth: 120,
      render: (row: ScheduleType) => (
        <ExecutionStatusBadge
          userEnabled={row.userEnabled ?? true}
          adminStatus={row.adminStatus ?? 'APPROVED'}
          sessionHealthy={sessionHealthy}
        />
      ),
    },
    {
      id: 'toggle',
      label: '활성화',
      minWidth: 80,
      align: 'center' as const,
      render: (row: ScheduleType) => {
        const isLocked = row.adminStatus !== 'APPROVED';
        const enabled = row.userEnabled ?? (row.status === 'ACTIVE');

        return (
          <Tooltip
            title={
              isLocked
                ? `관리자 ${row.adminStatus === 'NEEDS_REVIEW' ? '승인 대기' : '중지/차단'}됨`
                : enabled
                ? '클릭하여 비활성화'
                : '클릭하여 활성화'
            }
          >
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <Switch
                checked={enabled}
                onChange={() => handleToggle(row)}
                size="small"
                disabled={isLocked}
              />
              {isLocked && (
                <Lock
                  sx={{
                    position: 'absolute',
                    right: -4,
                    top: -4,
                    fontSize: 14,
                    color: 'warning.main',
                  }}
                />
              )}
            </Box>
          </Tooltip>
        );
      },
    },
    {
      id: 'actions',
      label: '',
      minWidth: 60,
      align: 'center' as const,
      render: (row: ScheduleType) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor({ element: e.currentTarget, schedule: row });
          }}
          sx={{
            color: 'text.secondary',
            '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08) },
          }}
        >
          <MoreVert fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      {/* 헤더 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Schedule sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, mb: 0.25 }}>
              스케줄
            </Typography>
            <Typography variant="body2" color="text.secondary">
              자동 포스팅 스케줄을 관리하세요
            </Typography>
          </Box>
        </Box>

        <AppButton
          variant="contained"
          startIcon={<Add />}
          onClick={() => router.push('/schedules/new')}
          sx={{
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            px: 2.5,
            '&:hover': {
              background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
            },
          }}
        >
          새 스케줄
        </AppButton>
      </Box>

      {/* 스케줄 테이블 */}
      <AppCard
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          '& .MuiTableHead-root': {
            bgcolor: (theme) => alpha(theme.palette.grey[100], 0.5),
          },
          '& .MuiTableCell-head': {
            fontWeight: 600,
            color: 'text.secondary',
            fontSize: '0.8125rem',
          },
        }}
      >
        <AppTable
          columns={columns}
          rows={schedules}
          keyField="id"
          loading={loading}
          page={page}
          limit={20}
          total={total}
          onPageChange={setPage}
          emptyMessage={
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Schedule sx={{ fontSize: 32, color: 'primary.main', opacity: 0.5 }} />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                스케줄이 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                새 스케줄을 만들어 자동 포스팅을 시작하세요
              </Typography>
              <AppButton
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => router.push('/schedules/new')}
              >
                새 스케줄 만들기
              </AppButton>
            </Box>
          }
        />
      </AppCard>

      {/* 액션 메뉴 */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            router.push(`/schedules/${menuAnchor?.schedule.id}`);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>수정</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && handleRunNow(menuAnchor.schedule)}>
          <ListItemIcon>
            <PlayArrow fontSize="small" />
          </ListItemIcon>
          <ListItemText>즉시 실행</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            router.push(`/schedules/${menuAnchor?.schedule.id}/history`);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <History fontSize="small" />
          </ListItemIcon>
          <ListItemText>실행 이력</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setDeleteTarget(menuAnchor.schedule);
              setMenuAnchor(null);
            }
          }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>삭제</ListItemText>
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={!!deleteTarget}
        title="스케줄 삭제"
        message={`"${deleteTarget?.name}" 스케줄을 삭제하시겠습니까?`}
        confirmText="삭제"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
