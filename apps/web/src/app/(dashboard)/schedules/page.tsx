'use client';

/**
 * 스케줄 목록 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, IconButton, Tooltip, Switch } from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable from '@/components/common/AppTable';
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

  const columns = [
    { id: 'name', label: '스케줄 이름', minWidth: 150 },
    {
      id: 'template',
      label: '템플릿',
      minWidth: 120,
      render: (row: Schedule) => row.template?.name || '-',
    },
    {
      id: 'interval',
      label: '실행 주기',
      minWidth: 100,
      render: (row: Schedule) => {
        if (row.intervalMinutes) return `${row.intervalMinutes}분`;
        if (row.cronExpr) return row.cronExpr;
        return '-';
      },
    },
    {
      id: 'todayCount',
      label: '오늘 게시',
      minWidth: 100,
      render: (row: Schedule) => `${row.todayPostCount}/${row.maxPostsPerDay}`,
    },
    {
      id: 'nextRunAt',
      label: '다음 실행',
      minWidth: 150,
      render: (row: Schedule) =>
        row.nextRunAt
          ? new Date(row.nextRunAt).toLocaleString('ko-KR')
          : '-',
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
      minWidth: 100,
      align: 'center' as const,
      render: (row: Schedule) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="수정">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/schedules/${row.id}`);
              }}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="삭제">
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
            >
              <Delete />
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




