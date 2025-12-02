'use client';

/**
 * 설정 페이지
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
} from '@mui/material';
import { Add, Delete, Refresh, Link as LinkIcon } from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import StatusChip from '@/components/common/StatusChip';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { naverSessionApi, authApi, NaverSession } from '@/lib/api-client';

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [sessions, setSessions] = useState<NaverSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NaverSession | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [userInfo, sessionList] = await Promise.all([
        authApi.me(),
        naverSessionApi.list(),
      ]);
      setUser(userInfo);
      setSessions(sessionList);
    } catch (error) {
      console.error('데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSession = async () => {
    try {
      setAddLoading(true);
      await naverSessionApi.create();
      alert('네이버 계정 연동이 시작되었습니다. Worker에서 브라우저가 열리면 로그인해주세요.');
      loadData();
    } catch (error) {
      alert('연동 시작 실패');
    } finally {
      setAddLoading(false);
    }
  };

  const handleReconnect = async (session: NaverSession) => {
    try {
      await naverSessionApi.reconnect(session.id);
      alert('재연동이 시작되었습니다.');
      loadData();
    } catch (error) {
      alert('재연동 실패');
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    try {
      await naverSessionApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      alert('삭제 실패');
    }
  };

  return (
    <Box>
      <Typography variant="h1" sx={{ mb: 1 }}>
        설정
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        계정 및 네이버 연동을 관리합니다
      </Typography>

      <Grid container spacing={3}>
        {/* 내 정보 */}
        <Grid item xs={12} md={6}>
          <AppCard title="내 정보">
            {user && (
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    이메일
                  </Typography>
                  <Typography>{user.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    이름
                  </Typography>
                  <Typography>{user.name || '미설정'}</Typography>
                </Box>
              </Box>
            )}
          </AppCard>
        </Grid>

        {/* 네이버 계정 연동 */}
        <Grid item xs={12} md={6}>
          <AppCard
            title="네이버 계정 연동"
            action={
              <AppButton
                variant="outlined"
                size="small"
                startIcon={<Add />}
                loading={addLoading}
                onClick={handleAddSession}
              >
                계정 추가
              </AppButton>
            }
          >
            {sessions.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <LinkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">
                  연동된 네이버 계정이 없습니다
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  계정을 추가하면 자동 포스팅이 가능합니다
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {sessions.map((session, index) => (
                  <Box key={session.id}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={session.naverId || '네이버 계정'}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <StatusChip status={session.status} />
                            {session.lastVerifiedAt && (
                              <Typography variant="caption" color="text.secondary">
                                최근 확인:{' '}
                                {new Date(session.lastVerifiedAt).toLocaleString('ko-KR')}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        {session.status === 'EXPIRED' && (
                          <IconButton
                            size="small"
                            onClick={() => handleReconnect(session)}
                            title="재연동"
                          >
                            <Refresh />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(session)}
                          title="삭제"
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                    {session.errorMessage && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        {session.errorMessage}
                      </Alert>
                    )}
                  </Box>
                ))}
              </List>
            )}
          </AppCard>
        </Grid>
      </Grid>

      <ConfirmDialog
        open={!!deleteTarget}
        title="네이버 계정 연동 해제"
        message="이 네이버 계정 연동을 해제하시겠습니까? 연동 해제 시 자동 포스팅이 중단됩니다."
        confirmText="연동 해제"
        confirmColor="error"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}




