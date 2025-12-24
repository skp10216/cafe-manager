'use client';

/**
 * 스케줄 상세/수정 페이지
 * 새로운 Daily Run 개념 기반
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
  Card,
  CardContent,
  FormControlLabel,
  Switch,
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
  runTime: z.string().regex(/^\d{2}:\d{2}$/, '올바른 시간 형식이 아닙니다 (HH:mm)'),
  dailyPostCount: z.coerce.number().min(1, '최소 1개 이상').max(100, '최대 100개'),
  postIntervalMinutes: z.coerce.number().min(1, '최소 1분').max(1440, '최대 1440분'),
  runImmediately: z.boolean().optional(),
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
    watch,
    setValue,
    formState: { errors },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      runTime: '09:00',
      dailyPostCount: 10,
      postIntervalMinutes: 5,
      runImmediately: false,
    },
  });

  // 실시간 프리뷰를 위한 watch
  const runTime = watch('runTime');
  const dailyPostCount = watch('dailyPostCount');
  const postIntervalMinutes = watch('postIntervalMinutes');
  const runImmediately = watch('runImmediately');

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
        runTime: schedule.runTime,
        dailyPostCount: schedule.dailyPostCount,
        postIntervalMinutes: schedule.postIntervalMinutes,
        runImmediately: false,
      });
    } catch (error) {
      setError('스케줄을 불러올 수 없습니다');
    }
  };

  const calculateEndTime = () => {
    if (!runTime || !dailyPostCount || !postIntervalMinutes) {
      return '--:--';
    }

    try {
      const [hours, minutes] = runTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + (dailyPostCount - 1) * postIntervalMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    } catch {
      return '--:--';
    }
  };

  const onSubmit = async (data: ScheduleForm) => {
    setError(null);
    setSaveLoading(true);

    try {
      const { runImmediately, ...scheduleData } = data;

      let schedule;
      if (isNew) {
        schedule = await scheduleApi.create(scheduleData);
      } else {
        schedule = await scheduleApi.update(id, scheduleData);
      }

      // 즉시 실행 옵션 처리
      if (runImmediately) {
        try {
          await scheduleApi.runNow(schedule.id);
          alert('저장 완료 및 즉시 실행이 시작되었습니다!');
        } catch (runError) {
          if (runError instanceof ApiError && runError.message.includes('이미 실행되었습니다')) {
            alert('저장은 완료되었으나, 오늘은 이미 실행되어 중복 실행되지 않았습니다.');
          } else {
            throw runError;
          }
        }
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
          {/* 기본 정보 */}
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
                  <FormControl fullWidth error={!!errors.templateId}>
                    <InputLabel>템플릿 선택</InputLabel>
                    <Select {...field} label="템플릿 선택">
                      {templates.map((template) => (
                        <MenuItem key={template.id} value={template.id}>
                          {template.name}
                          {template.cafeName && ` (${template.cafeName})`}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.templateId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                        {errors.templateId.message}
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </AppCard>
          </Grid>

          {/* 실행 설정 */}
          <Grid item xs={12} md={6}>
            <AppCard title="실행 설정">
              <TextField
                {...register('runTime')}
                label="매일 실행 시간"
                type="time"
                fullWidth
                error={!!errors.runTime}
                helperText={errors.runTime?.message || '매일 이 시간에 자동으로 실행됩니다'}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />

              <TextField
                {...register('dailyPostCount')}
                label="하루 게시글 수"
                type="number"
                fullWidth
                error={!!errors.dailyPostCount}
                helperText={errors.dailyPostCount?.message || '매일 등록할 게시글 개수'}
                sx={{ mb: 2 }}
              />

              <TextField
                {...register('postIntervalMinutes')}
                label="게시글 간격 (분)"
                type="number"
                fullWidth
                error={!!errors.postIntervalMinutes}
                helperText={errors.postIntervalMinutes?.message || '각 게시글 사이의 시간 간격'}
              />
            </AppCard>
          </Grid>

          {/* 실시간 프리뷰 */}
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: 'info.lighter' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  실행 미리보기
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                  매일 {runTime || '--:--'}부터 {postIntervalMinutes || 0}분 간격으로{' '}
                  {dailyPostCount || 0}개 글을 자동 등록합니다.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  예상 완료 시간: {calculateEndTime()}
                </Typography>
                {runImmediately && (
                  <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                    ⚠️ 저장 후 오늘 즉시 1회 실행됩니다 (하루 중복 실행 방지)
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* 즉시 실행 옵션 */}
          {isNew && (
            <Grid item xs={12}>
              <AppCard>
                <FormControlLabel
                  control={
                    <Controller
                      name="runImmediately"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      )}
                    />
                  }
                  label="저장 후 바로 오늘 1회 실행"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                  ON 시: 저장 직후 오늘의 스케줄을 즉시 실행합니다 (같은 날 중복 실행은 자동 방지됩니다)
                </Typography>
              </AppCard>
            </Grid>
          )}

          {/* 저장 버튼 */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <AppButton variant="outlined" onClick={() => router.push('/schedules')}>
                취소
              </AppButton>
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
