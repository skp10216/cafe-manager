'use client';

/**
 * 스케줄 상세/수정 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import { scheduleApi, templateApi, Template, ApiError } from '@/lib/api-client';

const scheduleSchema = z.object({
  name: z.string().min(1, '스케줄 이름을 입력하세요'),
  templateId: z.string().min(1, '템플릿을 선택하세요'),
  intervalMinutes: z.coerce.number().min(1).optional(),
  cronExpr: z.string().optional(),
  maxPostsPerDay: z.coerce.number().min(1).max(100).default(10),
});

type ScheduleForm = z.infer<typeof scheduleSchema>;

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      maxPostsPerDay: 10,
    },
  });

  useEffect(() => {
    loadTemplates();
    if (!isNew) {
      loadSchedule();
    }
  }, [id]);

  const loadTemplates = async () => {
    try {
      const response = await templateApi.list(1, 100);
      setTemplates(response.data);
    } catch (error) {
      console.error('템플릿 로딩 실패:', error);
    }
  };

  const loadSchedule = async () => {
    try {
      const schedule = await scheduleApi.get(id);
      reset({
        name: schedule.name,
        templateId: schedule.templateId,
        intervalMinutes: schedule.intervalMinutes || undefined,
        cronExpr: schedule.cronExpr || undefined,
        maxPostsPerDay: schedule.maxPostsPerDay,
      });
    } catch (error) {
      setError('스케줄을 불러올 수 없습니다');
    }
  };

  const onSubmit = async (data: ScheduleForm) => {
    setError(null);
    setSaveLoading(true);

    try {
      if (isNew) {
        await scheduleApi.create(data);
      } else {
        await scheduleApi.update(id, data);
      }
      router.push('/schedules');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('저장 중 오류가 발생했습니다');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <AppButton
          variant="text"
          startIcon={<ArrowBack />}
          onClick={() => router.push('/schedules')}
        >
          목록으로
        </AppButton>
      </Box>

      <Typography variant="h1" sx={{ mb: 3 }}>
        {isNew ? '새 스케줄' : '스케줄 수정'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <AppCard title="기본 정보">
              <TextField
                {...register('name')}
                label="스케줄 이름"
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{ mb: 2 }}
              />

              <Controller
                name="templateId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.templateId} sx={{ mb: 2 }}>
                    <InputLabel>템플릿 선택</InputLabel>
                    <Select {...field} label="템플릿 선택">
                      {templates.map((template) => (
                        <MenuItem key={template.id} value={template.id}>
                          {template.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </AppCard>
          </Grid>

          <Grid item xs={12} md={6}>
            <AppCard title="실행 설정">
              <TextField
                {...register('intervalMinutes')}
                label="실행 간격 (분)"
                type="number"
                fullWidth
                error={!!errors.intervalMinutes}
                helperText={errors.intervalMinutes?.message || '분 단위로 입력 (예: 60 = 1시간)'}
                sx={{ mb: 2 }}
              />

              <TextField
                {...register('cronExpr')}
                label="Cron 표현식 (선택)"
                fullWidth
                error={!!errors.cronExpr}
                helperText="고급 설정: 예) 0 9 * * * (매일 오전 9시)"
                sx={{ mb: 2 }}
              />

              <TextField
                {...register('maxPostsPerDay')}
                label="하루 최대 게시 수"
                type="number"
                fullWidth
                error={!!errors.maxPostsPerDay}
                helperText={errors.maxPostsPerDay?.message}
              />
            </AppCard>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <AppButton
                type="submit"
                variant="contained"
                startIcon={<Save />}
                loading={saveLoading}
              >
                저장
              </AppButton>
            </Box>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
}
