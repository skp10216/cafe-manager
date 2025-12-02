'use client';

/**
 * 템플릿 목록 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Add, Edit, Delete, PlayArrow } from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable from '@/components/common/AppTable';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { templateApi, Template } from '@/lib/api-client';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await templateApi.list(page);
      setTemplates(response.data);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('템플릿 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [page]);

  const handlePostNow = async (template: Template) => {
    try {
      const result = await templateApi.postNow(template.id);
      alert(`게시 작업이 등록되었습니다. Job ID: ${result.jobId}`);
    } catch (error) {
      alert('게시 요청 실패');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await templateApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadTemplates();
    } catch (error) {
      alert('삭제 실패');
    }
  };

  const columns = [
    { id: 'name', label: '템플릿 이름', minWidth: 150 },
    {
      id: 'cafeName',
      label: '카페',
      minWidth: 120,
      render: (row: Template) => row.cafeName || row.cafeId,
    },
    {
      id: 'boardName',
      label: '게시판',
      minWidth: 120,
      render: (row: Template) => row.boardName || row.boardId,
    },
    {
      id: 'subjectTemplate',
      label: '제목 템플릿',
      minWidth: 200,
      render: (row: Template) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
          {row.subjectTemplate}
        </Typography>
      ),
    },
    {
      id: 'createdAt',
      label: '생성일',
      minWidth: 120,
      render: (row: Template) =>
        new Date(row.createdAt).toLocaleDateString('ko-KR'),
    },
    {
      id: 'actions',
      label: '작업',
      minWidth: 150,
      align: 'center' as const,
      render: (row: Template) => (
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
          <Tooltip title="지금 게시">
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                handlePostNow(row);
              }}
            >
              <PlayArrow />
            </IconButton>
          </Tooltip>
          <Tooltip title="수정">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/templates/${row.id}`);
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
            템플릿
          </Typography>
          <Typography variant="body2" color="text.secondary">
            게시글 템플릿을 관리합니다
          </Typography>
        </Box>
        <AppButton
          variant="contained"
          startIcon={<Add />}
          onClick={() => router.push('/templates/new')}
        >
          새 템플릿
        </AppButton>
      </Box>

      <AppCard>
        <AppTable
          columns={columns}
          rows={templates}
          keyField="id"
          loading={loading}
          page={page}
          limit={20}
          total={total}
          onPageChange={setPage}
          emptyMessage="템플릿이 없습니다. 새 템플릿을 만들어보세요."
        />
      </AppCard>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="템플릿 삭제"
        message={`"${deleteTarget?.name}" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        confirmColor="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}




