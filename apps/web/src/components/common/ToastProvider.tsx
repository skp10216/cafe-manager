'use client';

/**
 * 토스트 알림 Provider
 * 프리미엄 디자인의 토스트 알림 시스템
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Box, 
  IconButton, 
  Typography, 
  Button,
  Slide,
  LinearProgress,
  alpha,
  keyframes,
} from '@mui/material';
import { 
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// ==============================================
// 애니메이션 정의
// ==============================================

const slideDown = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const slideUp = keyframes`
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`;

// ==============================================
// 타입 정의
// ==============================================

type AlertColor = 'success' | 'error' | 'warning' | 'info';

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
  createdAt: number;
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
// 디자인 토큰 (severity별 스타일)
// ==============================================

const TOAST_THEMES: Record<AlertColor, {
  gradient: string;
  iconBg: string;
  borderColor: string;
  shadowColor: string;
  progressColor: string;
  Icon: typeof CheckCircleIcon;
}> = {
  success: {
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    progressColor: 'rgba(255, 255, 255, 0.5)',
    Icon: CheckCircleIcon,
  },
  error: {
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
    shadowColor: 'rgba(239, 68, 68, 0.4)',
    progressColor: 'rgba(255, 255, 255, 0.5)',
    Icon: ErrorIcon,
  },
  warning: {
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    shadowColor: 'rgba(245, 158, 11, 0.4)',
    progressColor: 'rgba(255, 255, 255, 0.5)',
    Icon: WarningIcon,
  },
  info: {
    gradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)',
    iconBg: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    shadowColor: 'rgba(59, 130, 246, 0.4)',
    progressColor: 'rgba(255, 255, 255, 0.5)',
    Icon: InfoIcon,
  },
};

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
      createdAt: Date.now(),
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
      
      {/* 프리미엄 토스트 컨테이너 - 상단 중앙 */}
      <Box
        sx={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          maxWidth: 480,
          width: '90vw',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast, index) => (
          <PremiumToast
            key={toast.id}
            toast={toast}
            index={index}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </Box>
    </ToastContext.Provider>
  );
}

// ==============================================
// 프리미엄 토스트 컴포넌트
// ==============================================

interface PremiumToastProps {
  toast: ToastItem;
  index: number;
  onClose: () => void;
}

function PremiumToast({ toast, index, onClose }: PremiumToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  
  const theme = TOAST_THEMES[toast.severity || 'info'];
  const Icon = theme.Icon;
  const duration = toast.duration || 5000;

  // 프로그레스 바 애니메이션
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - (100 / (duration / 50));
        if (newProgress <= 0) {
          clearInterval(interval);
          handleClose();
          return 0;
        }
        return newProgress;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <Slide direction="down" in={!isExiting} timeout={300}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          pointerEvents: 'auto',
          animation: isExiting 
            ? `${slideUp} 0.3s ease-out forwards`
            : `${slideDown} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
          animationDelay: `${index * 0.05}s`,
        }}
      >
        {/* 메인 토스트 카드 */}
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 2.5,
            py: 2,
            background: theme.gradient,
            borderRadius: 3,
            border: `1px solid ${theme.borderColor}`,
            boxShadow: `
              0 4px 6px -1px ${alpha(theme.shadowColor, 0.3)},
              0 10px 20px -2px ${alpha(theme.shadowColor, 0.25)},
              0 0 40px -5px ${alpha(theme.shadowColor, 0.2)},
              inset 0 1px 0 rgba(255, 255, 255, 0.15)
            `,
            backdropFilter: 'blur(10px)',
            overflow: 'hidden',
            
            // 호버 효과
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              transform: 'scale(1.01)',
              boxShadow: `
                0 6px 10px -1px ${alpha(theme.shadowColor, 0.35)},
                0 14px 28px -2px ${alpha(theme.shadowColor, 0.3)},
                0 0 50px -5px ${alpha(theme.shadowColor, 0.25)},
                inset 0 1px 0 rgba(255, 255, 255, 0.2)
              `,
            },
          }}
        >
          {/* 배경 쉬머 효과 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(
                90deg,
                transparent 0%,
                rgba(255, 255, 255, 0.08) 50%,
                transparent 100%
              )`,
              backgroundSize: '200% 100%',
              animation: `${shimmer} 3s ease-in-out infinite`,
              pointerEvents: 'none',
            }}
          />

          {/* 아이콘 영역 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 2,
              backgroundColor: theme.iconBg,
              backdropFilter: 'blur(4px)',
              flexShrink: 0,
              animation: `${pulse} 2s ease-in-out infinite`,
            }}
          >
            <Icon 
              sx={{ 
                fontSize: 26, 
                color: '#fff',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              }} 
            />
          </Box>

          {/* 텍스트 영역 */}
          <Box sx={{ flex: 1, minWidth: 0, zIndex: 1 }}>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.95rem',
                color: '#fff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
                lineHeight: 1.4,
              }}
            >
              {toast.message}
            </Typography>
            {toast.description && (
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.85)',
                  mt: 0.5,
                  lineHeight: 1.3,
                }}
              >
                {toast.description}
              </Typography>
            )}
          </Box>

          {/* 액션 버튼들 */}
          {toast.actions && toast.actions.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, zIndex: 1 }}>
              {toast.actions.map((action, idx) => (
                <Button
                  key={idx}
                  size="small"
                  onClick={() => {
                    action.onClick();
                    handleClose();
                  }}
                  sx={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    textTransform: 'none',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 1.5,
                    px: 1.5,
                    py: 0.5,
                    minWidth: 'auto',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    },
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          )}

          {/* 닫기 버튼 */}
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 1.5,
              width: 32,
              height: 32,
              zIndex: 1,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
              },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>

          {/* 프로그레스 바 */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: theme.progressColor,
                transition: 'width 0.05s linear',
                boxShadow: `0 0 8px ${theme.progressColor}`,
              }}
            />
          </Box>
        </Box>
      </Box>
    </Slide>
  );
}

export default ToastProvider;





