'use client';

/**
 * 게시글 관리 페이지
 */

import { useEffect, useState } from 'react';
import { Box, Typography, Link, Chip } from '@mui/material';
import { Sync, OpenInNew } from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import AppTable from '@/components/common/AppTable';
import StatusChip from '@/components/common/StatusChip';
import { managedPostApi, ManagedPost } from '@/lib/api-client';

export default function PostsPage() {
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await managedPostApi.list({ page });
      setPosts(response.data);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('게시글 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [page]);

  const handleSync = async () => {
    try {
      setSyncLoading(true);
      const result = await managedPostApi.sync();
      alert(`동기화 작업이 등록되었습니다. Job ID: ${result.jobId}`);
    } catch (error) {
      alert('동기화 요청 실패');
    } finally {
      setSyncLoading(false);
    }
  };

  const columns = [
    {
      id: 'title',
      label: '제목',
      minWidth: 250,
      render: (row: ManagedPost) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
            {row.title}
          </Typography>
          <Link
            href={row.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <OpenInNew sx={{ fontSize: 16 }} />
          </Link>
        </Box>
      ),
    },
    {
      id: 'cafeId',
      label: '카페',
      minWidth: 100,
    },
    {
      id: 'createdAtRemote',
      label: '작성일',
      minWidth: 120,
      render: (row: ManagedPost) =>
        row.createdAtRemote
          ? new Date(row.createdAtRemote).toLocaleDateString('ko-KR')
          : '-',
    },
    {
      id: 'lastSyncedAt',
      label: '최근 동기화',
      minWidth: 150,
      render: (row: ManagedPost) =>
        new Date(row.lastSyncedAt).toLocaleString('ko-KR'),
    },
    {
      id: 'status',
      label: '상태',
      minWidth: 100,
      align: 'center' as const,
      render: (row: ManagedPost) => <StatusChip status={row.status} />,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h1" sx={{ mb: 1 }}>
            게시글 관리
          </Typography>
          <Typography variant="body2" color="text.secondary">
            네이버 카페에 게시된 내 글을 관리합니다
          </Typography>
        </Box>
        <AppButton
          variant="contained"
          startIcon={<Sync />}
          loading={syncLoading}
          onClick={handleSync}
        >
          동기화
        </AppButton>
      </Box>

      <AppCard>
        <AppTable
          columns={columns}
          rows={posts}
          keyField="id"
          loading={loading}
          page={page}
          limit={20}
          total={total}
          onPageChange={setPage}
          emptyMessage="동기화된 게시글이 없습니다. 동기화 버튼을 클릭해보세요."
        />
      </AppCard>
    </Box>
  );
}




