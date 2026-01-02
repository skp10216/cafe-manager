'use client';

/**
 * Admin 스케줄 승인 큐 페이지
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Pagination,
  Skeleton,
  alpha,
} from '@mui/material';
import {
  CheckCircle,
  Block,
  Pause,
  PlayArrow,
  Search,
  Refresh,
  FilterList,
} from '@mui/icons-material';
import AdminLayout from '@/components/AdminLayout';

/** 스케줄 타입 */
interface Schedule {
  id: string;
  name: string;
  userEnabled: boolean;
  adminStatus: 'NEEDS_REVIEW' | 'APPROVED' | 'SUSPENDED' | 'BANNED';
  adminReason: string | null;
  consecutiveFailures: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  template: {
    id: string;
    name: string;
    cafeName: string | null;
  };
}

/** 상태별 색상 */
const STATUS_COLORS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  NEEDS_REVIEW: 'warning',
  APPROVED: 'success',
  SUSPENDED: 'error',
  BANNED: 'error',
};

/** 상태별 라벨 */
const STATUS_LABELS: Record<string, string> = {
  NEEDS_REVIEW: '승인 대기',
  APPROVED: '승인됨',
  SUSPENDED: '일시 중지',
  BANNED: '영구 차단',
};

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // 선택된 스케줄 (일괄 작업용)
  const [selected, setSelected] = useState<string[]>([]);

  // 심사 다이얼로그
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    schedule: Schedule | null;
    action: 'APPROVE' | 'SUSPEND' | 'BAN' | 'UNSUSPEND' | null;
  }>({ open: false, schedule: null, action: null });
  const [reviewReason, setReviewReason] = useState('');

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(statusFilter && { adminStatus: statusFilter }),
        ...(search && { search }),
      });

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/admin/schedules?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSchedules(data.data);
        setTotalPages(data.meta.totalPages);
      }
    } catch (error) {
      console.error('스케줄 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // 심사 실행
  const handleReview = async () => {
    if (!reviewDialog.schedule || !reviewDialog.action) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/admin/schedules/${reviewDialog.schedule.id}/review`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: reviewDialog.action,
            reason: reviewReason || undefined,
          }),
        }
      );

      if (res.ok) {
        setReviewDialog({ open: false, schedule: null, action: null });
        setReviewReason('');
        loadSchedules();
      } else {
        const error = await res.json();
        alert(error.message || '처리 실패');
      }
    } catch (error) {
      alert('처리 중 오류가 발생했습니다');
    }
  };

  // 일괄 승인
  const handleBulkApprove = async () => {
    if (selected.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/admin/schedules/bulk-approve`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scheduleIds: selected }),
        }
      );

      if (res.ok) {
        setSelected([]);
        loadSchedules();
      }
    } catch (error) {
      alert('일괄 승인 중 오류가 발생했습니다');
    }
  };

  // 전체 선택 토글
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(schedules.map((s) => s.id));
    } else {
      setSelected([]);
    }
  };

  // 개별 선택 토글
  const handleSelectOne = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <AdminLayout>
      <Box>
        {/* 헤더 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h1" sx={{ mb: 0.5 }}>
              스케줄 승인 관리
            </Typography>
            <Typography variant="body2" color="text.secondary">
              사용자 스케줄을 검토하고 승인/중지/차단을 관리합니다
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {selected.length > 0 && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={handleBulkApprove}
              >
                선택 승인 ({selected.length})
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadSchedules}
            >
              새로고침
            </Button>
          </Box>
        </Box>

        {/* 필터 */}
        <Card sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="스케줄명 또는 이메일 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
              sx={{ minWidth: 280 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>상태</InputLabel>
              <Select
                value={statusFilter}
                label="상태"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">전체</MenuItem>
                <MenuItem value="NEEDS_REVIEW">승인 대기</MenuItem>
                <MenuItem value="APPROVED">승인됨</MenuItem>
                <MenuItem value="SUSPENDED">일시 중지</MenuItem>
                <MenuItem value="BANNED">영구 차단</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Card>

        {/* 테이블 */}
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.length > 0 && selected.length < schedules.length}
                      checked={schedules.length > 0 && selected.length === schedules.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>스케줄</TableCell>
                  <TableCell>사용자</TableCell>
                  <TableCell>템플릿</TableCell>
                  <TableCell align="center">상태</TableCell>
                  <TableCell align="center">연속 실패</TableCell>
                  <TableCell align="right">작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  // 스켈레톤
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell padding="checkbox">
                        <Skeleton variant="rectangular" width={20} height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton width="60%" />
                      </TableCell>
                      <TableCell>
                        <Skeleton width="80%" />
                      </TableCell>
                      <TableCell>
                        <Skeleton width="70%" />
                      </TableCell>
                      <TableCell align="center">
                        <Skeleton width={60} sx={{ mx: 'auto' }} />
                      </TableCell>
                      <TableCell align="center">
                        <Skeleton width={30} sx={{ mx: 'auto' }} />
                      </TableCell>
                      <TableCell align="right">
                        <Skeleton width={100} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">
                        스케줄이 없습니다
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => (
                    <TableRow key={schedule.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selected.includes(schedule.id)}
                          onChange={() => handleSelectOne(schedule.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {schedule.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {schedule.userEnabled ? '사용자 활성화' : '사용자 비활성화'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{schedule.user.email}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {schedule.user.name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{schedule.template.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {schedule.template.cafeName || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={STATUS_LABELS[schedule.adminStatus]}
                          color={STATUS_COLORS[schedule.adminStatus]}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          color={schedule.consecutiveFailures >= 3 ? 'error' : 'text.primary'}
                          fontWeight={schedule.consecutiveFailures >= 3 ? 600 : 400}
                        >
                          {schedule.consecutiveFailures}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          {schedule.adminStatus === 'NEEDS_REVIEW' && (
                            <Tooltip title="승인">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() =>
                                  setReviewDialog({ open: true, schedule, action: 'APPROVE' })
                                }
                              >
                                <CheckCircle />
                              </IconButton>
                            </Tooltip>
                          )}
                          {schedule.adminStatus !== 'BANNED' && (
                            <>
                              <Tooltip title="일시 중지">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() =>
                                    setReviewDialog({ open: true, schedule, action: 'SUSPEND' })
                                  }
                                >
                                  <Pause />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="영구 차단">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    setReviewDialog({ open: true, schedule, action: 'BAN' })
                                  }
                                >
                                  <Block />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {(schedule.adminStatus === 'SUSPENDED' ||
                            schedule.adminStatus === 'BANNED') && (
                            <Tooltip title="중지 해제">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() =>
                                  setReviewDialog({ open: true, schedule, action: 'UNSUSPEND' })
                                }
                              >
                                <PlayArrow />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
              />
            </Box>
          )}
        </Card>

        {/* 심사 다이얼로그 */}
        <Dialog
          open={reviewDialog.open}
          onClose={() => setReviewDialog({ open: false, schedule: null, action: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {reviewDialog.action === 'APPROVE' && '스케줄 승인'}
            {reviewDialog.action === 'SUSPEND' && '스케줄 일시 중지'}
            {reviewDialog.action === 'BAN' && '스케줄 영구 차단'}
            {reviewDialog.action === 'UNSUSPEND' && '스케줄 중지 해제'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>{reviewDialog.schedule?.name}</strong> 스케줄을{' '}
                {reviewDialog.action === 'APPROVE' && '승인합니다.'}
                {reviewDialog.action === 'SUSPEND' && '일시 중지합니다.'}
                {reviewDialog.action === 'BAN' && '영구 차단합니다.'}
                {reviewDialog.action === 'UNSUSPEND' && '다시 활성화합니다.'}
              </Typography>
              {(reviewDialog.action === 'SUSPEND' || reviewDialog.action === 'BAN') && (
                <TextField
                  fullWidth
                  label="사유 (필수)"
                  multiline
                  rows={3}
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  required
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setReviewDialog({ open: false, schedule: null, action: null })}
            >
              취소
            </Button>
            <Button
              variant="contained"
              color={
                reviewDialog.action === 'APPROVE'
                  ? 'success'
                  : reviewDialog.action === 'UNSUSPEND'
                  ? 'info'
                  : 'error'
              }
              onClick={handleReview}
              disabled={
                (reviewDialog.action === 'SUSPEND' || reviewDialog.action === 'BAN') &&
                !reviewReason
              }
            >
              확인
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}




