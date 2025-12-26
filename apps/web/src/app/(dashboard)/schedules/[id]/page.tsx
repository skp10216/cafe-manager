'use client';

/**
 * 스케줄 상세/수정 페이지 - Premium Edition
 * 프리미엄 B2B SaaS 스타일 UI
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Divider,
  alpha,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  Save,
  ArrowBack,
  Schedule,
  Description,
  PlayArrow,
  AccessTime,
  Repeat,
  PostAdd,
  CheckCircle,
  Info,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  const [templateLoading, setTemplateLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isValid },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      templateId: '',
      runTime: '09:00',
      dailyPostCount: 10,
      postIntervalMinutes: 5,
      runImmediately: false,
    },
  });

  // 실시간 프리뷰를 위한 watch
  const watchedValues = watch();
  const { name, templateId, runTime, dailyPostCount, postIntervalMinutes, runImmediately } = watchedValues;

  // 선택된 템플릿 정보
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === templateId);
  }, [templates, templateId]);

  // 실행 설정이 유효한지 확인
  const isExecutionSettingsValid = useMemo(() => {
    return (
      runTime &&
      /^\d{2}:\d{2}$/.test(runTime) &&
      dailyPostCount >= 1 &&
      postIntervalMinutes >= 1
    );
  }, [runTime, dailyPostCount, postIntervalMinutes]);

  useEffect(() => {
    loadTemplates();
    if (!isNew) {
      loadSchedule();
    }
  }, [id]);

  const loadTemplates = async () => {
    try {
      setTemplateLoading(true);
      const response = await templateApi.list(1, 100);
      setTemplates(response.data);
    } catch (error) {
      console.error('템플릿 로딩 실패:', error);
    } finally {
      setTemplateLoading(false);
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
    if (!isExecutionSettingsValid) return null;

    try {
      const [hours, minutes] = runTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + (dailyPostCount - 1) * postIntervalMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

  const calculateTotalDuration = () => {
    if (!isExecutionSettingsValid) return null;
    const totalMinutes = (dailyPostCount - 1) * postIntervalMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
    }
    return `${minutes}분`;
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

  const endTime = calculateEndTime();
  const totalDuration = calculateTotalDuration();

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4 }}>
        <AppButton
          variant="text"
          startIcon={<ArrowBack />}
          onClick={() => router.push('/schedules')}
          sx={{ mb: 2, ml: -1 }}
        >
          목록으로
        </AppButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Schedule sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography
              variant="h1"
              sx={{ fontSize: '1.5rem', fontWeight: 700, mb: 0.25 }}
            >
              {isNew ? '새 스케줄 만들기' : '스케줄 수정'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              자동 포스팅 스케줄을 설정하세요
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* 기본 정보 섹션 */}
        <Box
          sx={{
            mb: 3,
            p: 3,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              }}
            >
              <Description sx={{ fontSize: 18, color: 'primary.main' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              기본 정보
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              {...register('name')}
              label="스케줄 이름"
              placeholder="예: 중고폰 카페 자동 포스팅"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message || '이 스케줄을 구분할 수 있는 이름을 입력하세요'}
              InputProps={{
                sx: { borderRadius: 2 },
              }}
            />

            <Controller
              name="templateId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.templateId}>
                  <InputLabel>게시글 템플릿</InputLabel>
                  <Select
                    {...field}
                    label="게시글 템플릿"
                    sx={{ borderRadius: 2 }}
                    disabled={templateLoading}
                  >
                    {templateLoading ? (
                      <MenuItem disabled>
                        <Skeleton width={200} />
                      </MenuItem>
                    ) : templates.length === 0 ? (
                      <MenuItem disabled>
                        템플릿이 없습니다. 먼저 템플릿을 만들어주세요.
                      </MenuItem>
                    ) : (
                      templates.map((template) => (
                        <MenuItem key={template.id} value={template.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{template.name}</span>
                            {template.cafeName && (
                              <Chip
                                size="small"
                                label={template.cafeName}
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {errors.templateId && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                      {errors.templateId.message}
                    </Typography>
                  )}
                  {!errors.templateId && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 2 }}>
                      스케줄 실행 시 이 템플릿으로 게시글이 작성됩니다
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* 선택된 템플릿 미리보기 */}
            {selectedTemplate && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.04),
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.info.main, 0.15),
                }}
              >
                <Typography variant="caption" color="info.main" sx={{ fontWeight: 600 }}>
                  선택된 템플릿
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                  {selectedTemplate.subjectTemplate || '(제목 없음)'}
                </Typography>
                {selectedTemplate.cafeName && (
                  <Typography variant="caption" color="text.secondary">
                    {selectedTemplate.cafeName} › {selectedTemplate.boardName || '게시판'}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {/* 실행 설정 섹션 */}
        <Box
          sx={{
            mb: 3,
            p: 3,
            borderRadius: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.1),
              }}
            >
              <AccessTime sx={{ fontSize: 18, color: 'success.main' }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              실행 설정
            </Typography>
          </Box>

          {/* 3열 입력 필드 */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2.5,
              mb: 3,
            }}
          >
            {/* 시작 시간 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PlayArrow sx={{ fontSize: 16, color: 'success.main' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  시작 시간
                </Typography>
              </Box>
              <TextField
                {...register('runTime')}
                type="time"
                fullWidth
                error={!!errors.runTime}
                helperText={errors.runTime?.message}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  sx: {
                    borderRadius: 2,
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    '& input': { textAlign: 'center' },
                  },
                }}
              />
            </Box>

            {/* 게시글 수 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PostAdd sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  하루 게시글 수
                </Typography>
              </Box>
              <TextField
                {...register('dailyPostCount')}
                type="number"
                fullWidth
                error={!!errors.dailyPostCount}
                helperText={errors.dailyPostCount?.message}
                InputProps={{
                  sx: {
                    borderRadius: 2,
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    '& input': { textAlign: 'center' },
                  },
                  endAdornment: (
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      개
                    </Typography>
                  ),
                }}
              />
            </Box>

            {/* 게시 간격 */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Repeat sx={{ fontSize: 16, color: 'warning.main' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  게시 간격
                </Typography>
              </Box>
              <TextField
                {...register('postIntervalMinutes')}
                type="number"
                fullWidth
                error={!!errors.postIntervalMinutes}
                helperText={errors.postIntervalMinutes?.message}
                InputProps={{
                  sx: {
                    borderRadius: 2,
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    '& input': { textAlign: 'center' },
                  },
                  endAdornment: (
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      분
                    </Typography>
                  ),
                }}
              />
            </Box>
          </Box>

          {/* 실행 미리보기 - 설정이 유효할 때만 표시 */}
          {isExecutionSettingsValid && (
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                background: (theme) =>
                  `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                border: '1px solid',
                borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.dark' }}>
                  실행 미리보기
                </Typography>
              </Box>

              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1, color: 'text.primary' }}>
                매일 {runTime}부터 {postIntervalMinutes}분 간격으로 {dailyPostCount}개 게시
              </Typography>

              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    예상 완료:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {endTime}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" color="text.secondary">
                    총 소요:
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {totalDuration}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* 저장 후 즉시 실행 옵션 */}
          {isNew && (
            <>
              <Divider sx={{ my: 3 }} />
              
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.warning.main, 0.04),
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.warning.main, 0.15),
                }}
              >
                <Controller
                  name="runImmediately"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          sx={{
                            color: 'warning.main',
                            '&.Mui-checked': { color: 'warning.main' },
                          }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            저장 후 바로 오늘 1회 실행
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            저장 직후 오늘의 스케줄을 즉시 실행합니다 (같은 날 중복 실행은 자동 방지)
                          </Typography>
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', m: 0 }}
                    />
                  )}
                />

                {runImmediately && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Info sx={{ fontSize: 18, color: 'warning.main' }} />
                    <Typography variant="caption" color="warning.dark">
                      저장 시 오늘 설정된 시간과 관계없이 즉시 {dailyPostCount || 0}개 게시글이 등록됩니다
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* 저장 버튼 */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <AppButton
            variant="outlined"
            onClick={() => router.push('/schedules')}
            sx={{ minWidth: 100 }}
          >
            취소
          </AppButton>
          <AppButton
            type="submit"
            variant="contained"
            startIcon={<Save />}
            loading={saveLoading}
            sx={{
              minWidth: 140,
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
              },
            }}
          >
            {isNew ? '스케줄 저장' : '변경사항 저장'}
          </AppButton>
        </Box>
      </form>
    </Box>
  );
}
