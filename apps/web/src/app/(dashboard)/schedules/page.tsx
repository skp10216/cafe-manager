'use client';

/**
 * 스케줄 목록 페이지
 * Daily Run 개념 기반
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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  PlayArrow,
  History,
} from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable, { Column } from '@/components/common/AppTable';
import StatusChip from '@/components/common/StatusChip';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { scheduleApi, Schedule } from '@/lib/api-client';

export default function SchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; schedule: Schedule } | null>(
    null
  );

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

  useEffect(() => {
    loadSchedules();
  }, [page]);

  const handleToggle = async (schedule: Schedule) => {
    try {
      const newStatus = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
      await scheduleApi.toggle(schedule.id, newStatus);
      loadSchedules();
    } catch (error) {
      alert('상태 변경 실패');
    }
  };

  const handleRunNow = async (schedule: Schedule) => {
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

  const calculateNextRun = (runTime: string): string => {
    try {
      const now = new Date();
      const [hours, minutes] = runTime.split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      // 오늘 실행 시간이 지났으면 내일로
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const isToday = nextRun.getDate() === now.getDate();
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      return isToday ? `오늘 ${timeStr}` : `내일 ${timeStr}`;
    } catch {
      return '-';
    }
  };

  const columns: Column<Schedule>[] = [
    { id: 'name', field: 'name', label: '스케줄 이름', minWidth: 150 },
    {
      id: 'summary',
      label: '실행 설정',
      minWidth: 200,
      render: (row: Schedule) =>
        `매일 ${row.runTime} · ${row.dailyPostCount}개 · ${row.postIntervalMinutes}분 간격`,
    },
    {
      id: 'template',
      label: '템플릿',
      minWidth: 150,
      render: (row: Schedule) => {
        if (!row.template) return '-';
        return (
          <Box>
            <Typography variant="body2">{row.template.name}</Typography>
            {row.template.cafeName && (
              <Typography variant="caption" color="text.secondary">
                {row.template.cafeName}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      id: 'nextRun',
      label: '다음 실행',
      minWidth: 120,
      render: (row: Schedule) => {
        if (row.status !== 'ACTIVE') return '-';
        return calculateNextRun(row.runTime);
      },
    },
    {
      id: 'lastRun',
      label: '마지막 실행',
      minWidth: 120,
      render: (row: Schedule) => {
        if (!row.lastRunDate) return '실행 기록 없음';
        const date = new Date(row.lastRunDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastRun = new Date(date);
        lastRun.setHours(0, 0, 0, 0);

        if (lastRun.getTime() === today.getTime()) {
          return '오늘';
        } else if (lastRun.getTime() === today.getTime() - 86400000) {
          return '어제';
        } else {
          return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        }
      },
    },
    {
      id: 'status',
      label: '상태',
      minWidth: 100,
      align: 'center' as const,
      render: (row: Schedule) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
          <Switch
            checked={row.status === 'ACTIVE'}
            onChange={() => handleToggle(row)}
            size="small"
          />
          <StatusChip status={row.status} />
        </Box>
      ),
    },
    {
      id: 'actions',
      label: '작업',
      minWidth: 80,
      align: 'center' as const,
      render: (row: Schedule) => (
        <Box>
          <Tooltip title="더보기">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor({ element: e.currentTarget, schedule: row });
              }}
            >
              <MoreVert />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 1 }}>
            스케줄
          </Typography>
          <Typography variant="body2" color="text.secondary">
            자동 포스팅 스케줄을 관리합니다
          </Typography>
        </Box>
        <AppButton
          variant="contained"
          startIcon={<Add />}
          onClick={() => router.push('/schedules/new')}
        >
          새 스케줄
        </AppButton>
      </Box>

      <AppCard>
        <AppTable
          columns={columns}
          rows={schedules}
          keyField="id"
          loading={loading}
          page={page}
          limit={20}
          total={total}
          onPageChange={setPage}
          emptyMessage="스케줄이 없습니다. 새 스케줄을 만들어보세요."
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
