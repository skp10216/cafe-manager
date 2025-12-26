'use client';

/**
 * 설정 페이지 (프리미엄 UX)
 * - 사용자 계정 정보
 * - 네이버 계정 관리 (한 번에 연동)
 * - 연동 상태 실시간 표시
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
  DialogContent,
  alpha,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Fade,
  Chip,
  Paper,
} from '@mui/material';
import {
  Add,
  Delete,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Visibility,
  VisibilityOff,
  Person,
  LinkOff,
  Verified,
  Schedule,
  Warning,
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

/** 연동 진행 단계 */
type LinkingStep = 'idle' | 'saving' | 'connecting' | 'verifying' | 'done' | 'error';

const LINKING_STEPS = ['계정 저장', '네이버 연결', '상태 확인'];

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

  // 연동 진행 상태
  const [linkingStep, setLinkingStep] = useState<LinkingStep>('idle');
  const [linkingError, setLinkingError] = useState<string | null>(null);
  const [linkingSessionId, setLinkingSessionId] = useState<string | null>(null);

  // 삭제 확인 다이얼로그
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<NaverAccount | null>(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<NaverSession | null>(null);

  // 로딩 상태 (세션 검증, 재연결 등)
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

  /**
   * 네이버 계정 추가 + 자동 연동
   * 1. 계정 생성 (백엔드에서 자동으로 세션+Job 생성)
   * 2. 연동 완료까지 폴링
   */
  const handleAddAccount = async () => {
    if (!newAccountForm.loginId || !newAccountForm.password) {
      setLinkingError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setLinkingError(null);
    setLinkingStep('saving');

    try {
      // 1단계: 계정 저장 (백엔드에서 세션+Job 자동 생성)
      const result = await naverAccountApi.create({
        loginId: newAccountForm.loginId,
        password: newAccountForm.password,
        displayName: newAccountForm.displayName || undefined,
      });

      // 세션 ID 저장 (응답에 포함)
      const sessionId = (result as { session?: { id: string } }).session?.id;
      setLinkingSessionId(sessionId || null);
      setLinkingStep('connecting');

      // 2단계: 연동 완료 대기 (폴링)
      if (sessionId) {
        const maxAttempts = 45; // 최대 90초 대기
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const sessions = await naverSessionApi.list();
          const session = sessions.find((s) => s.id === sessionId);

          if (session) {
            if (session.status === 'HEALTHY') {
              // 3단계: 완료
              setLinkingStep('verifying');
              await new Promise((resolve) => setTimeout(resolve, 500));
              setLinkingStep('done');
              setNaverSessions(sessions);
              await loadNaverAccounts();

              // 1.5초 후 다이얼로그 닫기
              setTimeout(() => {
                setAddAccountOpen(false);
                resetForm();
              }, 1500);
              return;
            } else if (session.status === 'ERROR' || session.status === 'EXPIRED') {
              throw new Error(session.errorMessage || '연동에 실패했습니다.');
            } else if (session.status === 'CHALLENGE_REQUIRED') {
              throw new Error('추가 인증이 필요합니다. 네이버에서 보안 설정을 확인해주세요.');
            }
          }
        }
        throw new Error('연동 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('네이버 계정 추가 실패:', error);
      setLinkingStep('error');
      setLinkingError(
        error instanceof Error ? error.message : '연동에 실패했습니다.'
      );
      // 실패해도 목록은 새로고침
      await loadNaverAccounts();
      await loadNaverSessions();
    }
  };

  const resetForm = () => {
    setNewAccountForm({ loginId: '', password: '', displayName: '' });
    setShowPassword(false);
    setLinkingStep('idle');
    setLinkingError(null);
    setLinkingSessionId(null);
  };

  const handleCloseDialog = () => {
    if (linkingStep === 'idle' || linkingStep === 'done' || linkingStep === 'error') {
      setAddAccountOpen(false);
      resetForm();
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

  // 세션 검증
  const handleVerifySession = async (sessionId: string) => {
    try {
      setActionLoading(`verify-${sessionId}`);
      await naverSessionApi.verify(sessionId);

      const maxAttempts = 15;
      let previousVerifiedAt: string | null = null;
      const currentSession = naverSessions.find((s) => s.id === sessionId);
      previousVerifiedAt = currentSession?.lastVerifiedAt || null;

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const sessions = await naverSessionApi.list();
        const session = sessions.find((s) => s.id === sessionId);

        if (session && session.lastVerifiedAt !== previousVerifiedAt) {
          setNaverSessions(sessions);
          return;
        }
      }
      await loadNaverSessions();
    } catch (error) {
      console.error('세션 검증 실패:', error);
      alert('세션 검증에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  };

  // 세션 재연결
  const handleReconnectSession = async (sessionId: string) => {
    try {
      setActionLoading(`reconnect-${sessionId}`);
      await naverSessionApi.reconnect(sessionId);

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

  // 연동 스텝 인덱스 계산
  const getStepIndex = (): number => {
    switch (linkingStep) {
      case 'saving':
        return 0;
      case 'connecting':
        return 1;
      case 'verifying':
      case 'done':
        return 2;
      default:
        return -1;
    }
  };

  // 세션 상태별 아이콘/색상
  const getSessionStatusInfo = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return { icon: <Verified />, color: 'success.main', label: '정상 연결' };
      case 'PENDING':
        return { icon: <Schedule />, color: 'info.main', label: '연결 중...' };
      case 'EXPIRING':
        return { icon: <Warning />, color: 'warning.main', label: '곧 만료' };
      case 'CHALLENGE_REQUIRED':
        return { icon: <Warning />, color: 'warning.main', label: '인증 필요' };
      case 'ERROR':
        return { icon: <ErrorIcon />, color: 'error.main', label: '오류' };
      case 'EXPIRED':
        return { icon: <LinkOff />, color: 'error.main', label: '만료됨' };
      default:
        return { icon: <ErrorIcon />, color: 'text.secondary', label: '알 수 없음' };
    }
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

        {/* 라이선스 정보 */}
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

        {/* 네이버 계정 관리 - 프리미엄 UI */}
        <Grid item xs={12}>
          <AppCard
            title="네이버 계정 연동"
            action={
              <AppButton
                variant="contained"
                size="small"
                startIcon={<Add />}
                onClick={() => setAddAccountOpen(true)}
              >
                새 계정 연동
              </AppButton>
            }
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              네이버 카페에 자동 게시하기 위해 네이버 계정을 연동합니다.
              아이디/비밀번호 입력 후 자동으로 연결됩니다.
            </Typography>

            {accountsLoading ? (
              <Box>
                {[1, 2].map((i) => (
                  <Skeleton key={i} height={120} sx={{ mb: 2, borderRadius: 2 }} />
                ))}
              </Box>
            ) : naverAccounts.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  textAlign: 'center',
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 3,
                }}
              >
                <Person sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  연동된 네이버 계정이 없습니다
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  네이버 계정을 연동하여 자동 게시 기능을 사용하세요
                </Typography>
                <AppButton
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setAddAccountOpen(true)}
                >
                  첫 계정 연동하기
                </AppButton>
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {naverAccounts.map((account) => {
                  const session = getSessionForAccount(account.id);
                  const isVerifying = session && actionLoading === `verify-${session.id}`;
                  const isReconnecting = session && actionLoading === `reconnect-${session.id}`;
                  const statusInfo = session ? getSessionStatusInfo(session.status) : null;

                  return (
                    <Paper
                      key={account.id}
                      elevation={0}
                      sx={{
                        p: 2.5,
                        border: '1px solid',
                        borderColor: session?.status === 'HEALTHY' 
                          ? (theme) => alpha(theme.palette.success.main, 0.3)
                          : 'divider',
                        borderRadius: 2,
                        backgroundColor: session?.status === 'HEALTHY'
                          ? (theme) => alpha(theme.palette.success.main, 0.02)
                          : 'background.paper',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: session?.status === 'HEALTHY' 
                            ? 'success.main'
                            : 'primary.main',
                          boxShadow: 1,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flex: 1 }}>
                          {/* 상태 아이콘 */}
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: statusInfo 
                                ? (theme) => alpha(
                                    theme.palette[statusInfo.color.split('.')[0] as 'success' | 'error' | 'warning' | 'info'].main,
                                    0.1
                                  )
                                : 'action.hover',
                              color: statusInfo?.color || 'text.secondary',
                            }}
                          >
                            {session?.status === 'PENDING' ? (
                              <CircularProgress size={24} color="inherit" />
                            ) : statusInfo ? (
                              statusInfo.icon
                            ) : (
                              <Person />
                            )}
                          </Box>

                          {/* 계정 정보 */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle1" fontWeight={600} noWrap>
                                {account.displayName || account.loginId}
                              </Typography>
                              {session && (
                                <Chip
                                  size="small"
                                  label={statusInfo?.label || session.status}
                                  sx={{
                                    height: 22,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    backgroundColor: statusInfo
                                      ? (theme) => alpha(
                                          theme.palette[statusInfo.color.split('.')[0] as 'success' | 'error' | 'warning' | 'info'].main,
                                          0.1
                                        )
                                      : 'action.hover',
                                    color: statusInfo?.color || 'text.secondary',
                                  }}
                                />
                              )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              @{account.loginId}
                              {session?.naverNickname && (
                                <> · 닉네임: <strong>{session.naverNickname}</strong></>
                              )}
                            </Typography>
                            {session?.lastVerifiedAt && (
                              <Typography variant="caption" color="text.secondary">
                                마지막 확인: {new Date(session.lastVerifiedAt).toLocaleString('ko-KR')}
                              </Typography>
                            )}
                            {session?.errorMessage && (
                              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                                {session.errorMessage}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* 액션 버튼 */}
                        <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                          {session && (
                            <>
                              <Tooltip title="상태 확인">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleVerifySession(session.id)}
                                    disabled={!!isVerifying || session.status === 'PENDING'}
                                  >
                                    {isVerifying ? (
                                      <CircularProgress size={18} />
                                    ) : (
                                      <CheckCircle fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="재연결">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleReconnectSession(session.id)}
                                    disabled={!!isReconnecting || session.status === 'PENDING'}
                                  >
                                    {isReconnecting ? (
                                      <CircularProgress size={18} />
                                    ) : (
                                      <Refresh fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="계정 삭제">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteAccountTarget(account)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </AppCard>
        </Grid>
      </Grid>

      {/* 네이버 계정 연동 다이얼로그 - 프리미엄 UI */}
      <Dialog
        open={addAccountOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, overflow: 'hidden' },
        }}
      >
        {/* 헤더 */}
        <Box
          sx={{
            background: (theme) =>
              `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white',
            p: 3,
            textAlign: 'center',
          }}
        >
          <Person sx={{ fontSize: 48, mb: 1, opacity: 0.9 }} />
          <Typography variant="h5" fontWeight={700}>
            네이버 계정 연동
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            아이디와 비밀번호 입력 후 자동으로 연결됩니다
          </Typography>
        </Box>

        <DialogContent sx={{ p: 3 }}>
          {/* 연동 진행 중 - 스텝퍼 표시 */}
          {linkingStep !== 'idle' && linkingStep !== 'error' && (
            <Fade in>
              <Box sx={{ mb: 3 }}>
                <Stepper activeStep={getStepIndex()} alternativeLabel>
                  {LINKING_STEPS.map((label, index) => (
                    <Step key={label} completed={getStepIndex() > index || linkingStep === 'done'}>
                      <StepLabel
                        StepIconComponent={() => {
                          const isActive = getStepIndex() === index;
                          const isCompleted = getStepIndex() > index || linkingStep === 'done';
                          return (
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isCompleted
                                  ? 'success.main'
                                  : isActive
                                  ? 'primary.main'
                                  : 'action.disabledBackground',
                                color: isCompleted || isActive ? 'white' : 'text.disabled',
                                transition: 'all 0.3s ease',
                              }}
                            >
                              {isActive && !isCompleted ? (
                                <CircularProgress size={16} sx={{ color: 'white' }} />
                              ) : isCompleted ? (
                                <CheckCircle sx={{ fontSize: 18 }} />
                              ) : (
                                <Typography variant="caption" fontWeight={600}>
                                  {index + 1}
                                </Typography>
                              )}
                            </Box>
                          );
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>

                {/* 완료 메시지 */}
                {linkingStep === 'done' && (
                  <Fade in>
                    <Alert
                      severity="success"
                      icon={<CheckCircle />}
                      sx={{ mt: 2, borderRadius: 2 }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        연동이 완료되었습니다!
                      </Typography>
                      <Typography variant="caption">
                        이제 네이버 카페에 자동 게시할 수 있습니다.
                      </Typography>
                    </Alert>
                  </Fade>
                )}
              </Box>
            </Fade>
          )}

          {/* 에러 표시 */}
          {linkingError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {linkingError}
            </Alert>
          )}

          {/* 입력 폼 - 진행 중이 아닐 때만 표시 */}
          {(linkingStep === 'idle' || linkingStep === 'error') && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
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
                autoFocus
                disabled={linkingStep !== 'idle' && linkingStep !== 'error'}
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
                disabled={linkingStep !== 'idle' && linkingStep !== 'error'}
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
                disabled={linkingStep !== 'idle' && linkingStep !== 'error'}
              />

              <Divider sx={{ my: 1 }} />

              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                <AppButton
                  variant="text"
                  onClick={handleCloseDialog}
                  disabled={linkingStep !== 'idle' && linkingStep !== 'error'}
                >
                  취소
                </AppButton>
                <AppButton
                  variant="contained"
                  onClick={handleAddAccount}
                  disabled={
                    !newAccountForm.loginId ||
                    !newAccountForm.password ||
                    (linkingStep !== 'idle' && linkingStep !== 'error')
                  }
                  sx={{ minWidth: 120 }}
                >
                  연동 시작
                </AppButton>
              </Box>
            </Box>
          )}

          {/* 진행 중일 때 - 로딩 상태 */}
          {linkingStep !== 'idle' && linkingStep !== 'error' && linkingStep !== 'done' && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {linkingStep === 'saving' && '계정 정보를 저장하고 있습니다...'}
                {linkingStep === 'connecting' && '네이버에 연결하고 있습니다...'}
                {linkingStep === 'verifying' && '연결 상태를 확인하고 있습니다...'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                잠시만 기다려주세요
              </Typography>
            </Box>
          )}
        </DialogContent>
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
