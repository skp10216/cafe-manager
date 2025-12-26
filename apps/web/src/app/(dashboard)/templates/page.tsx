'use client';

/**
 * 템플릿 목록 페이지 - Premium Edition
 * 프리미엄 B2B SaaS 스타일 UI
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Image as ImageIcon,
  Description,
  MoreVert,
  Store,
} from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable, { Column } from '@/components/common/AppTable';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { templateApi, Template } from '@/lib/api-client';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; template: Template } | null>(null);

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
      alert(
        `게시 작업이 등록되었습니다.\n\n` +
        `제목: ${result.preview.title}\n` +
        `이미지: ${result.preview.imageCount}개\n\n` +
        `Job ID: ${result.jobId}`
      );
    } catch (error) {
      alert('게시 요청 실패');
    }
    setMenuAnchor(null);
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

  const columns: Column<Template>[] = [
    {
      id: 'name',
      label: '템플릿',
      minWidth: 220,
      render: (row: Template) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.1),
              flexShrink: 0,
            }}
          >
            <Description sx={{ fontSize: 20, color: 'secondary.main' }} />
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
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
                maxWidth: 180,
              }}
            >
              {row.subjectTemplate}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'cafe',
      label: '카페 / 게시판',
      minWidth: 160,
      render: (row: Template) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Store sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {row.cafeName || row.cafeId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.boardName || row.boardId}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'imageCount',
      label: '이미지',
      minWidth: 90,
      align: 'center' as const,
      render: (row: Template) => (
        <Chip
          icon={<ImageIcon sx={{ fontSize: '14px !important' }} />}
          label={row.imageCount || 0}
          size="small"
          variant={row.imageCount ? 'filled' : 'outlined'}
          color={row.imageCount ? 'primary' : 'default'}
          sx={{
            height: 26,
            fontWeight: 600,
            '& .MuiChip-icon': { ml: 0.5 },
          }}
        />
      ),
    },
    {
      id: 'createdAt',
      label: '생성일',
      minWidth: 100,
      render: (row: Template) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(row.createdAt).toLocaleDateString('ko-KR')}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: '',
      minWidth: 60,
      align: 'center' as const,
      render: (row: Template) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor({ element: e.currentTarget, template: row });
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
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
            }}
          >
            <Description sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700, mb: 0.25 }}>
              템플릿
            </Typography>
            <Typography variant="body2" color="text.secondary">
              게시글 템플릿을 관리하세요
            </Typography>
          </Box>
        </Box>

        <AppButton
          variant="contained"
          startIcon={<Add />}
          onClick={() => router.push('/templates/new')}
          sx={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
            px: 2.5,
            '&:hover': {
              background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
            },
          }}
        >
          새 템플릿
        </AppButton>
      </Box>

      {/* 템플릿 테이블 */}
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
          rows={templates}
          keyField="id"
          loading={loading}
          page={page}
          limit={20}
          total={total}
          onPageChange={setPage}
          onRowClick={(row) => router.push(`/templates/${row.id}`)}
          emptyMessage={
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Description sx={{ fontSize: 32, color: 'secondary.main', opacity: 0.5 }} />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                템플릿이 없습니다
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                새 템플릿을 만들어 게시글 자동화를 시작하세요
              </Typography>
              <AppButton
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => router.push('/templates/new')}
              >
                새 템플릿 만들기
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            router.push(`/templates/${menuAnchor?.template.id}`);
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>수정</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && handlePostNow(menuAnchor.template)}>
          <ListItemIcon>
            <PlayArrow fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>지금 게시</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              setDeleteTarget(menuAnchor.template);
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
