'use client';

/**
 * 로그인 페이지
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, CardContent, TextField, Typography, Alert, Link } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppButton from '@/components/common/AppButton';
import { authApi, setAuthToken, ApiError } from '@/lib/api-client';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setLoading(true);

    try {
      const response = await authApi.login(data.email, data.password);
      setAuthToken(response.accessToken, response.refreshToken);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('로그인 중 오류가 발생했습니다');
      }
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
        backgroundColor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          {/* 로고 */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h1" color="primary" sx={{ mb: 1 }}>
              카페매니저
            </Typography>
            <Typography variant="body2" color="text.secondary">
              네이버 카페 자동 포스팅 솔루션
            </Typography>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              {...register('email')}
              label="이메일"
              type="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{ mb: 2 }}
            />

            <TextField
              {...register('password')}
              label="비밀번호"
              type="password"
              fullWidth
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={{ mb: 3 }}
            />

            <AppButton type="submit" variant="contained" fullWidth size="large" loading={loading}>
              로그인
            </AppButton>
          </form>

          {/* 회원가입 링크 */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              계정이 없으신가요?{' '}
              <Link href="/register" underline="hover">
                회원가입
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}


