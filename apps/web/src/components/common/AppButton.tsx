'use client';

/**
 * 공통 버튼 컴포넌트
 */

import { Button, ButtonProps, CircularProgress } from '@mui/material';
import { ReactNode } from 'react';

interface AppButtonProps extends Omit<ButtonProps, 'children'> {
  children: ReactNode;
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

export default function AppButton({
  children,
  loading = false,
  disabled,
  startIcon,
  endIcon,
  ...props
}: AppButtonProps) {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : startIcon}
      endIcon={endIcon}
    >
      {children}
    </Button>
  );
}






