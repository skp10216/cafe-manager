'use client';

/**
 * 설정 페이지
 * - 사용자 계정 정보
 * - 네이버 계정 관리
 * - 네이버 세션 관리
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add,
  Delete,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import StatusChip from '@/components/common/StatusChip';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import {
  authApi,
  naverAccountApi,
  naverSessionApi,
  NaverAccount,
  NaverSession,
} from '@/lib/api-client';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
}

export default function SettingsPage() {
  // 사용자 정보
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // 네이버 계정
  const [naverAccounts, setNaverAccounts] = useState<NaverAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  // 네이버 세션
  const [naverSessions, setNaverSessions] = useState<NaverSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // 네이버 계정 추가 다이얼로그
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    loginId: '',
    password: '',
    displayName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [addAccountLoading, setAddAccountLoading] = useState(false);

  // 삭제 확인 다이얼로그
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<NaverAccount | null>(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<NaverSession | null>(null);

  // 로딩 상태 (세션 생성, 검증 등)
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 데이터 로드
  const loadUserProfile = useCallback(async () => {
    try {
      setUserLoading(true);
      const userData = await authApi.me();
      setUser(userData);
    } catch (error) {
      console.error('사용자 정보 로딩 실패:', error);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const loadNaverAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      const accounts = await naverAccountApi.list();
      setNaverAccounts(accounts);
    } catch (error) {
      console.error('네이버 계정 로딩 실패:', error);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadNaverSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const sessions = await naverSessionApi.list();
      setNaverSessions(sessions);
    } catch (error) {
      console.error('네이버 세션 로딩 실패:', error);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserProfile();
    loadNaverAccounts();
    loadNaverSessions();
  }, [loadUserProfile, loadNaverAccounts, loadNaverSessions]);

  // 네이버 계정 추가
  const handleAddAccount = async () => {
    if (!newAccountForm.loginId || !newAccountForm.password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setAddAccountLoading(true);
      await naverAccountApi.create({
        loginId: newAccountForm.loginId,
        password: newAccountForm.password,
        displayName: newAccountForm.displayName || undefined,
      });
      setAddAccountOpen(false);
      setNewAccountForm({ loginId: '', password: '', displayName: '' });
      await loadNaverAccounts();
    } catch (error) {
      console.error('네이버 계정 추가 실패:', error);
      alert('네이버 계정 추가에 실패했습니다.');
    } finally {
      setAddAccountLoading(false);
    }
  };

  // 네이버 계정 삭제
  const handleDeleteAccount = async () => {
    if (!deleteAccountTarget) return;
    try {
      await naverAccountApi.delete(deleteAccountTarget.id);
      setDeleteAccountTarget(null);
      await loadNaverAccounts();
      await loadNaverSessions();
    } catch (error) {
      console.error('네이버 계정 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 세션 생성
  // - create API는 Job을 생성하고 즉시 응답하므로, 상태가 변경될 때까지 폴링 필요
  const handleCreateSession = async (accountId: string) => {
    try {
      setActionLoading(`create-session-${accountId}`);
      const newSession = await naverSessionApi.create(accountId);

      // Job이 완료될 때까지 폴링 (최대 60초, 2초 간격)
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const sessions = await naverSessionApi.list();
        const session = sessions.find((s) => s.id === newSession.id);

        if (session && session.status !== 'PENDING') {
          setNaverSessions(sessions);
          return;
        }
      }

      // 타임아웃 시 최종 상태 로드
      await loadNaverSessions();
    } catch (error) {
      console.error('세션 생성 실패:', error);
      alert('세션 생성에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 세션 검증
  // - verify API는 Job을 생성하고 즉시 응답하므로, 결과가 반영될 때까지 폴링 필요
  const handleVerifySession = async (sessionId: string) => {
    try {
      setActionLoading(`verify-${sessionId}`);
      await naverSessionApi.verify(sessionId);

      // Job이 완료될 때까지 폴링 (최대 30초, 2초 간격)
      const maxAttempts = 15;
      let previousVerifiedAt: string | null = null;

      // 현재 검증 시간 저장
      const currentSession = naverSessions.find((s) => s.id === sessionId);
      previousVerifiedAt = currentSession?.lastVerifiedAt || null;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const sessions = await naverSessionApi.list();
        const session = sessions.find((s) => s.id === sessionId);

        // lastVerifiedAt이 변경되었거나 상태가 변경되면 완료
        if (session && session.lastVerifiedAt !== previousVerifiedAt) {
          setNaverSessions(sessions);
          return;
        }
      }

      // 타임아웃 시 최종 상태 로드
      await loadNaverSessions();
    } catch (error) {
      console.error('세션 검증 실패:', error);
      alert('세션 검증에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 세션 재연결
  // - reconnect API는 Job을 생성하고 즉시 응답하므로, 상태가 변경될 때까지 폴링 필요
  const handleReconnectSession = async (sessionId: string) => {
    try {
      setActionLoading(`reconnect-${sessionId}`);
      await naverSessionApi.reconnect(sessionId);

      // Job이 완료될 때까지 폴링 (최대 60초, 2초 간격)
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const sessions = await naverSessionApi.list();
        const session = sessions.find((s) => s.id === sessionId);

        if (session && session.status !== 'PENDING') {
          setNaverSessions(sessions);
          return;
        }
      }

      // 타임아웃 시 최종 상태 로드
      await loadNaverSessions();
    } catch (error) {
      console.error('세션 재연결 실패:', error);
      alert('세션 재연결에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 세션 삭제
  const handleDeleteSession = async () => {
    if (!deleteSessionTarget) return;
    try {
      await naverSessionApi.delete(deleteSessionTarget.id);
      setDeleteSessionTarget(null);
      await loadNaverSessions();
    } catch (error) {
      console.error('세션 삭제 실패:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 계정에 연결된 세션 찾기
  const getSessionForAccount = (accountId: string): NaverSession | undefined => {
    return naverSessions.find((s) => s.naverAccountId === accountId);
  };

  return (
    <Box>
      {/* 페이지 타이틀 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" sx={{ mb: 1 }}>
          설정
        </Typography>
        <Typography variant="body2" color="text.secondary">
          계정 및 네이버 연동을 관리합니다
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* 사용자 정보 */}
        <Grid item xs={12} md={6}>
          <AppCard title="내 계정">
            {userLoading ? (
              <Box>
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Box>
            ) : user ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    이메일
                  </Typography>
                  <Typography variant="body1">{user.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    이름
                  </Typography>
                  <Typography variant="body1">{user.name || '-'}</Typography>
                </Box>
              </Box>
            ) : (
              <Alert severity="error">사용자 정보를 불러올 수 없습니다.</Alert>
            )}
          </AppCard>
        </Grid>

        {/* 라이선스 정보 (추후 확장) */}
        <Grid item xs={12} md={6}>
          <AppCard title="라이선스">
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                무료 플랜
              </Typography>
              <Typography variant="caption" color="text.secondary">
                프리미엄 기능은 추후 제공될 예정입니다
              </Typography>
            </Box>
          </AppCard>
        </Grid>

        {/* 네이버 계정 관리 */}
        <Grid item xs={12}>
          <AppCard
            title="네이버 계정 관리"
            action={
              <AppButton
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddAccountOpen(true)}
              >
                계정 추가
              </AppButton>
            }
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              네이버 카페에 자동 게시하기 위해 네이버 계정을 등록하고 세션을 연동합니다.
            </Typography>

            {accountsLoading ? (
              <Box>
                {[1, 2].map((i) => (
                  <Skeleton key={i} height={80} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : naverAccounts.length === 0 ? (
              <Alert severity="info">
                등록된 네이버 계정이 없습니다. 계정을 추가하여 자동 게시 기능을 사용하세요.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {naverAccounts.map((account) => {
                  const session = getSessionForAccount(account.id);
                  const isCreatingSession = actionLoading === `create-session-${account.id}`;
                  const isVerifying = session && actionLoading === `verify-${session.id}`;
                  const isReconnecting = session && actionLoading === `reconnect-${session.id}`;

                  return (
                    <Box
                      key={account.id}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        backgroundColor: 'background.paper',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                              {account.displayName || account.loginId}
                            </Typography>
                            <StatusChip status={account.status} size="small" />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            아이디: {account.loginId}
                          </Typography>
                          {account.lastLoginAt && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              마지막 로그인:{' '}
                              {new Date(account.lastLoginAt).toLocaleString('ko-KR')}
                            </Typography>
                          )}
                        </Box>
                        <Tooltip title="계정 삭제">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteAccountTarget(account)}
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      {/* 세션 정보 */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          브라우저 세션
                        </Typography>
                        {sessionsLoading ? (
                          <Skeleton height={40} />
                        ) : session ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.5,
                              backgroundColor: 'action.hover',
                              borderRadius: 1,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {session.status === 'ACTIVE' ? (
                                <CheckCircle color="success" fontSize="small" />
                              ) : (
                                <ErrorIcon
                                  color={session.status === 'ERROR' ? 'error' : 'warning'}
                                  fontSize="small"
                                />
                              )}
                              <Box>
                                <Typography variant="body2">
                                  {session.naverNickname || '닉네임 미확인'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  상태: <StatusChip status={session.status} size="small" />
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="세션 검증">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleVerifySession(session.id)}
                                    disabled={!!isVerifying}
                                  >
                                    <CheckCircle />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="재연결">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleReconnectSession(session.id)}
                                    disabled={!!isReconnecting}
                                  >
                                    <Refresh />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="세션 삭제">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteSessionTarget(session)}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ textAlign: 'center', py: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              연결된 세션이 없습니다
                            </Typography>
                            <AppButton
                              variant="outlined"
                              size="small"
                              onClick={() => handleCreateSession(account.id)}
                              loading={isCreatingSession}
                            >
                              세션 연결
                            </AppButton>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </AppCard>
        </Grid>
      </Grid>

      {/* 네이버 계정 추가 다이얼로그 */}
      <Dialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>네이버 계정 추가</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              네이버 아이디와 비밀번호는 암호화되어 안전하게 저장됩니다.
            </Alert>
            <TextField
              label="네이버 아이디"
              fullWidth
              value={newAccountForm.loginId}
              onChange={(e) =>
                setNewAccountForm((prev) => ({ ...prev, loginId: e.target.value }))
              }
              placeholder="네이버 아이디 입력"
            />
            <TextField
              label="비밀번호"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              value={newAccountForm.password}
              onChange={(e) =>
                setNewAccountForm((prev) => ({ ...prev, password: e.target.value }))
              }
              placeholder="비밀번호 입력"
              InputProps={{
                endAdornment: (
                  <IconButton
                    size="small"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                ),
              }}
            />
            <TextField
              label="표시 이름 (선택)"
              fullWidth
              value={newAccountForm.displayName}
              onChange={(e) =>
                setNewAccountForm((prev) => ({ ...prev, displayName: e.target.value }))
              }
              placeholder="관리용 이름 (예: 매장1 계정)"
              helperText="계정을 구분하기 쉽게 표시될 이름입니다"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <AppButton variant="text" onClick={() => setAddAccountOpen(false)}>
            취소
          </AppButton>
          <AppButton
            variant="contained"
            onClick={handleAddAccount}
            loading={addAccountLoading}
          >
            추가
          </AppButton>
        </DialogActions>
      </Dialog>

      {/* 계정 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!deleteAccountTarget}
        title="네이버 계정 삭제"
        message={`"${deleteAccountTarget?.displayName || deleteAccountTarget?.loginId}" 계정을 삭제하시겠습니까? 연결된 세션도 함께 삭제됩니다.`}
        confirmText="삭제"
        confirmColor="error"
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteAccountTarget(null)}
      />

      {/* 세션 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!deleteSessionTarget}
        title="세션 삭제"
        message="이 세션을 삭제하시겠습니까? 자동 게시를 위해 다시 연결해야 합니다."
        confirmText="삭제"
        confirmColor="error"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteSessionTarget(null)}
      />
    </Box>
  );
}
