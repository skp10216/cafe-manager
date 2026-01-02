'use client';

/**
 * 토스트 알림 Provider
 * 앱 전역에서 사용할 수 있는 토스트 알림 시스템
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Snackbar, Alert, AlertColor, Button, Box, IconButton, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

// ==============================================
// 타입 정의
// ==============================================

/** 토스트 액션 버튼 */
interface ToastAction {
  label: string;
  onClick: () => void;
}

/** 토스트 옵션 */
interface ToastOptions {
  /** 메시지 */
  message: string;
  /** 심각도 */
  severity?: AlertColor;
  /** 지속 시간 (ms) */
  duration?: number;
  /** 액션 버튼들 */
  actions?: ToastAction[];
  /** 상세 설명 (선택) */
  description?: string;
}

/** 토스트 아이템 */
interface ToastItem extends ToastOptions {
  id: string;
}

/** 토스트 컨텍스트 */
interface ToastContextValue {
  /** 토스트 표시 */
  showToast: (options: ToastOptions) => void;
  /** 성공 토스트 */
  success: (message: string, options?: Partial<ToastOptions>) => void;
  /** 에러 토스트 */
  error: (message: string, options?: Partial<ToastOptions>) => void;
  /** 경고 토스트 */
  warning: (message: string, options?: Partial<ToastOptions>) => void;
  /** 정보 토스트 */
  info: (message: string, options?: Partial<ToastOptions>) => void;
}

// ==============================================
// 컨텍스트 생성
// ==============================================

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * 토스트 훅
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// ==============================================
// Provider 컴포넌트
// ==============================================

interface ToastProviderProps {
  children: React.ReactNode;
  /** 최대 동시 표시 개수 */
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 토스트 추가
  const showToast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastItem = {
      id,
      severity: 'info',
      duration: 5000,
      ...options,
    };

    setToasts((prev) => {
      // 최대 개수 제한
      const updated = [...prev, newToast];
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });
  }, [maxToasts]);

  // 토스트 제거
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 편의 메서드들
  const success = useCallback(
    (message: string, options?: Partial<ToastOptions>) => {
      showToast({ message, severity: 'success', ...options });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<ToastOptions>) => {
      showToast({ message, severity: 'error', duration: 8000, ...options });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<ToastOptions>) => {
      showToast({ message, severity: 'warning', ...options });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<ToastOptions>) => {
      showToast({ message, severity: 'info', ...options });
    },
    [showToast]
  );

  const contextValue = useMemo(
    () => ({ showToast, success, error, warning, info }),
    [showToast, success, error, warning, info]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* 토스트 컨테이너 */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 1,
          maxWidth: 420,
        }}
      >
        {toasts.map((toast) => (
          <ToastSnackbar
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </Box>
    </ToastContext.Provider>
  );
}

// ==============================================
// 개별 토스트 컴포넌트
// ==============================================

interface ToastSnackbarProps {
  toast: ToastItem;
  onClose: () => void;
}

function ToastSnackbar({ toast, onClose }: ToastSnackbarProps) {
  const [open, setOpen] = useState(true);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  const handleExited = () => {
    onClose();
  };

  return (
    <Snackbar
      open={open}
      autoHideDuration={toast.duration}
      onClose={handleClose}
      TransitionProps={{ onExited: handleExited }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ position: 'relative', mb: 0 }}
    >
      <Alert
        severity={toast.severity}
        variant="filled"
        onClose={handleClose}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {toast.actions?.map((action, index) => (
              <Button
                key={index}
                color="inherit"
                size="small"
                onClick={() => {
                  action.onClick();
                  handleClose();
                }}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 1,
                }}
              >
                {action.label}
              </Button>
            ))}
            <IconButton
              size="small"
              color="inherit"
              onClick={handleClose}
              sx={{ ml: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{
          width: '100%',
          alignItems: 'flex-start',
          '& .MuiAlert-message': {
            flex: 1,
            pr: 1,
          },
          '& .MuiAlert-action': {
            pt: 0,
            alignItems: 'flex-start',
          },
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {toast.message}
          </Typography>
          {toast.description && (
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, opacity: 0.9 }}
            >
              {toast.description}
            </Typography>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
}

export default ToastProvider;




