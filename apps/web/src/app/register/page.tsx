'use client';

/**
 * 회원가입 페이지
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, CardContent, TextField, Typography, Alert, Link } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppButton from '@/components/common/AppButton';
import { authApi, setAuthToken, clearAuthToken, ApiError } from '@/lib/api-client';

const registerSchema = z
  .object({
    email: z.string().email('올바른 이메일을 입력하세요'),
    password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
    passwordConfirm: z.string(),
    name: z.string().min(2, '이름은 2자 이상이어야 합니다').optional().or(z.literal('')),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['passwordConfirm'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 회원가입 페이지 진입 시 기존 토큰 삭제 (보안: 이전 사용자 세션 완전 정리)
  useEffect(() => {
    clearAuthToken();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    setLoading(true);

    try {
      // 중요: 회원가입 전 기존 토큰 삭제 (이전 사용자 데이터 노출 방지)
      clearAuthToken();
      
      const response = await authApi.register(data.email, data.password, data.name || undefined);
      setAuthToken(response.accessToken, response.refreshToken);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('회원가입 중 오류가 발생했습니다');
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
              회원가입
            </Typography>
            <Typography variant="body2" color="text.secondary">
              카페매니저를 시작해보세요
            </Typography>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* 회원가입 폼 */}
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
              {...register('name')}
              label="이름 (선택)"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
              sx={{ mb: 2 }}
            />

            <TextField
              {...register('password')}
              label="비밀번호"
              type="password"
              fullWidth
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={{ mb: 2 }}
            />

            <TextField
              {...register('passwordConfirm')}
              label="비밀번호 확인"
              type="password"
              fullWidth
              error={!!errors.passwordConfirm}
              helperText={errors.passwordConfirm?.message}
              sx={{ mb: 3 }}
            />

            <AppButton type="submit" variant="contained" fullWidth size="large" loading={loading}>
              회원가입
            </AppButton>
          </form>

          {/* 로그인 링크 */}
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" underline="hover">
                로그인
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}






