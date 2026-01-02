'use client';

/**
 * Admin 로그인 폼
 * 관리자 계정으로 로그인하여 JWT 토큰을 발급받습니다.
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AdminPanelSettings, Login } from '@mui/icons-material';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || '로그인에 실패했습니다.');
      }

      // 관리자 권한 확인
      if (data.user?.role !== 'ADMIN') {
        throw new Error('관리자 권한이 필요합니다.');
      }

      // 토큰 저장
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('adminUser', JSON.stringify(data.user));

      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: '100%',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* 헤더 */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                p: 2,
                borderRadius: 3,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                mb: 2,
              }}
            >
              <AdminPanelSettings sx={{ fontSize: 40 }} />
            </Box>
            <Typography variant="h1" sx={{ mb: 1 }}>
              카페매니저 Admin
            </Typography>
            <Typography variant="body2" color="text.secondary">
              관리자 계정으로 로그인하세요
            </Typography>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="이메일"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="비밀번호"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <Login />}
              sx={{ py: 1.5 }}
            >
              {loading ? '로그인 중...' : '관리자 로그인'}
            </Button>
          </form>

          {/* 안내 문구 */}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', mt: 3 }}
          >
            관리자 권한(ADMIN)이 있는 계정만 접근 가능합니다.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}



