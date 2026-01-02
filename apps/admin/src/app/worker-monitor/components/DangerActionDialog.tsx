'use client';

/**
 * Danger Action Dialog
 * 위험 작업 2단계 확인 다이얼로그
 * - 1단계: 경고 + 확인 텍스트 입력
 * - 2단계: 최종 확인
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Box,
  Alert,
  alpha,
  CircularProgress,
} from '@mui/material';
import { Warning } from '@mui/icons-material';

interface DangerActionDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmText: string;  // 사용자가 입력해야 하는 확인 텍스트
  impact?: string;      // 영향 설명
  buttonLabel?: string; // 확인 버튼 라벨
}

export default function DangerActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  impact,
  buttonLabel = '실행',
}: DangerActionDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmValid = inputValue === confirmText;

  const handleConfirm = useCallback(async () => {
    if (!isConfirmValid) return;

    setLoading(true);
    setError(null);

    try {
      await onConfirm();
      setInputValue('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '작업 실행 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [isConfirmValid, onConfirm, onClose]);

  const handleClose = useCallback(() => {
    if (loading) return;
    setInputValue('');
    setError(null);
    onClose();
  }, [loading, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          border: '2px solid',
          borderColor: 'error.main',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Warning sx={{ color: 'error.main' }} />
        <Typography variant="h6" component="span" fontWeight={600}>
          {title}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        {/* 경고 메시지 */}
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={500}>
            이 작업은 되돌릴 수 없습니다!
          </Typography>
        </Alert>

        {/* 설명 */}
        <Typography variant="body1" sx={{ mb: 2 }}>
          {description}
        </Typography>

        {/* 영향 설명 */}
        {impact && (
          <Box
            sx={{
              p: 2,
              mb: 3,
              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'warning.main',
            }}
          >
            <Typography variant="body2" color="warning.main" fontWeight={500}>
              영향: {impact}
            </Typography>
          </Box>
        )}

        {/* 확인 텍스트 입력 */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            계속하려면 <strong>&quot;{confirmText}&quot;</strong>를 입력하세요:
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={confirmText}
            disabled={loading}
            error={inputValue.length > 0 && !isConfirmValid}
            helperText={
              inputValue.length > 0 && !isConfirmValid
                ? '텍스트가 일치하지 않습니다.'
                : ''
            }
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace',
              },
            }}
          />
        </Box>

        {/* 에러 표시 */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined">
          취소
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!isConfirmValid || loading}
          variant="contained"
          color="error"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {loading ? '처리 중...' : buttonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}



