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
  Stack,
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
  Bolt,
  CalendarMonth,
  NavigateNext,
  PauseCircle,
  PlayCircle,
  History,
  WarningAmber,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppButton from '@/components/common/AppButton';
import AppCard from '@/components/common/AppCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import FailureHistoryDialog from '@/components/common/FailureHistoryDialog';
import { useToast } from '@/components/common/ToastProvider';
import { dashboardApi, scheduleApi, templateApi, Template, ApiError, Schedule as ScheduleType } from '@/lib/api-client';
import { isIntegrationOK } from '@/lib/session-status';

const scheduleSchema = z.object({
  name: z.string().min(1, '스케줄 이름을 입력하세요'),
  templateId: z.string().min(1, '템플릿을 선택하세요'),
  dailyPostCount: z.coerce.number().min(1, '최소 1개 이상').max(100, '최대 100개'),
  postIntervalMinutes: z.coerce.number().min(1, '최소 1분').max(1440, '최대 1440분'),
  scheduleType: z.enum(['immediate', 'scheduled']), // 저장 후 바로 실행 / 예약 설정
  runTime: z.string().optional(), // 예약 설정일 때만 필수
}).refine(
  (data) => {
    // 예약 설정일 때만 runTime 유효성 검사
    if (data.scheduleType === 'scheduled') {
      return data.runTime && /^\d{2}:\d{2}$/.test(data.runTime);
    }
    return true;
  },
  {
    message: '예약 시간을 입력해주세요 (HH:mm)',
    path: ['runTime'],
  }
);

type ScheduleForm = z.infer<typeof scheduleSchema>;

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';
  const toast = useToast();

  const [scheduleMeta, setScheduleMeta] = useState<ScheduleType | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{
    type: 'pause' | 'resume' | 'run';
    schedule: ScheduleType;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failureOpen, setFailureOpen] = useState(false);
  const [sessionHealthy, setSessionHealthy] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      templateId: '',
      dailyPostCount: 10,
      postIntervalMinutes: 5,
      scheduleType: 'immediate', // 디폴트: 저장 후 바로 실행
      runTime: '09:00',
    },
  });

  // 실시간 프리뷰를 위한 watch
  const watchedValues = watch();
  const { name, templateId, dailyPostCount, postIntervalMinutes, scheduleType, runTime } = watchedValues;

  // 선택된 템플릿 정보
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === templateId);
  }, [templates, templateId]);

  // 실행 설정이 유효한지 확인
  const isExecutionSettingsValid = useMemo(() => {
    const basicValid = dailyPostCount >= 1 && postIntervalMinutes >= 1;
    if (scheduleType === 'immediate') {
      return basicValid;
    }
    return basicValid && runTime && /^\d{2}:\d{2}$/.test(runTime);
  }, [scheduleType, runTime, dailyPostCount, postIntervalMinutes]);

  useEffect(() => {
    loadTemplates();
    if (!isNew) {
      loadSchedule();
    }
    loadSessionStatus();
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

  // 세션 상태 로드 (SSOT: isIntegrationOK 사용)
  const loadSessionStatus = async () => {
    try {
      const integrationStatus = await dashboardApi.getIntegrationStatus();
      // SSOT: 연동 상태가 OK 또는 WARNING이면 실행 가능
      setSessionHealthy(isIntegrationOK(integrationStatus.status));
    } catch (err) {
      console.error('세션 상태 확인 실패:', err);
      setSessionHealthy(false);
    }
  };

  const loadSchedule = async () => {
    try {
      const schedule = await scheduleApi.get(id);
      setScheduleMeta(schedule);
      reset({
        name: schedule.name,
        templateId: schedule.templateId,
        dailyPostCount: schedule.dailyPostCount,
        postIntervalMinutes: schedule.postIntervalMinutes,
        scheduleType: schedule.scheduleType === 'IMMEDIATE' ? 'immediate' : 'scheduled',
        runTime: schedule.runTime || '09:00',
      });
    } catch (error) {
      setError('스케줄을 불러올 수 없습니다');
    }
  };

  const validateRunPrerequisites = (schedule: ScheduleType) => {
    if (!schedule.userEnabled) {
      return '스케줄이 비활성화되어 있습니다. 먼저 활성화해주세요.';
    }
    if (schedule.adminStatus !== 'APPROVED') {
      return '관리자 승인이 필요합니다.';
    }
    if (!sessionHealthy) {
      return '네이버 연동이 필요합니다. 설정에서 연동 상태를 확인해주세요.';
    }
    return null;
  };

  const performToggle = async (schedule: ScheduleType, newEnabled: boolean) => {
    if (schedule.adminStatus !== 'APPROVED') {
      toast.warning('관리자 승인이 필요합니다.');
      return;
    }

    try {
      await scheduleApi.toggleEnabled(schedule.id, newEnabled);
      toast.success(newEnabled ? '스케줄이 재개되었습니다.' : '스케줄이 일시정지되었습니다.');
      await loadSchedule();
    } catch (err) {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const performRunNow = async (schedule: ScheduleType) => {
    const validation = validateRunPrerequisites(schedule);
    if (validation) {
      toast.warning(validation);
      return;
    }

    try {
      await scheduleApi.runNow(schedule.id);
      toast.success('즉시 실행을 요청했습니다.');
      await loadSchedule();
    } catch (err: any) {
      if (err?.message?.includes('이미 실행되었습니다')) {
        toast.info('오늘은 이미 실행되어 중복 실행되지 않았습니다.');
      } else {
        toast.error(`즉시 실행 실패: ${err?.message || '알 수 없는 오류'}`);
      }
    }
  };

  const handleActionConfirm = async () => {
    if (!actionTarget) return;
    setActionLoading(true);

    try {
      if (actionTarget.type === 'run') {
        await performRunNow(actionTarget.schedule);
      } else {
        await performToggle(actionTarget.schedule, actionTarget.type === 'resume');
      }
    } finally {
      setActionLoading(false);
      setActionTarget(null);
    }
  };

  const calculateEndTime = (startTime?: string) => {
    if (!isExecutionSettingsValid) return null;

    try {
      // 즉시 실행은 현재 시간 기준, 예약 설정은 설정된 시간 기준
      let baseHours: number, baseMinutes: number;
      
      if (scheduleType === 'immediate') {
        const now = new Date();
        baseHours = now.getHours();
        baseMinutes = now.getMinutes();
      } else {
        const timeStr = startTime || runTime || '09:00';
        [baseHours, baseMinutes] = timeStr.split(':').map(Number);
      }

      const totalMinutes = baseHours * 60 + baseMinutes + (dailyPostCount - 1) * postIntervalMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    } catch {
      return null;
    }
  };

  // 즉시 실행 시 시작 시간 (현재 시간)
  const getImmediateStartTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // 예상 게시 시간 목록 생성
  const getPostTimeList = () => {
    if (!isExecutionSettingsValid || scheduleType === 'immediate') return null;

    try {
      const times: string[] = [];
      const [hours, minutes] = (runTime || '09:00').split(':').map(Number);
      let currentMinutes = hours * 60 + minutes;

      for (let i = 0; i < Math.min(dailyPostCount, 4); i++) {
        const h = Math.floor(currentMinutes / 60) % 24;
        const m = currentMinutes % 60;
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        currentMinutes += postIntervalMinutes;
      }

      return times;
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

  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(Math.abs(diffMs) / (1000 * 60));
    const diffHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));

    if (diffMinutes < 1) return '지금';
    if (diffMinutes < 60) return diffMs >= 0 ? `${diffMinutes}분 후` : `${diffMinutes}분 전`;
    if (diffHours < 24) return diffMs >= 0 ? `${diffHours}시간 후` : `${diffHours}시간 전`;
    const diffDays = Math.round(diffHours / 24);
    return diffMs >= 0 ? `${diffDays}일 후` : `${diffDays}일 전`;
  };

  const getNextRunInfo = () => {
    if (!scheduleMeta) return null;
    if (!scheduleMeta.userEnabled || scheduleMeta.adminStatus !== 'APPROVED' || !sessionHealthy) {
      return { text: '-', isActive: false };
    }

    if (scheduleMeta.nextRunAt) {
      const date = new Date(scheduleMeta.nextRunAt);
      const timeText = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const dayText = date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
      return {
        text: `${dayText} ${timeText}`,
        subText: formatRelativeTime(scheduleMeta.nextRunAt) || undefined,
        isActive: true,
      };
    }

    // fallback 계산
    try {
      const now = new Date();
      const [hours, minutes] = (scheduleMeta.runTime || '00:00').split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);
      if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);

      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const diff = formatRelativeTime(nextRun.toISOString());
      return {
        text: `${nextRun.getDate() === now.getDate() ? '오늘' : '내일'} ${timeStr}`,
        subText: diff || undefined,
        isActive: true,
      };
    } catch {
      return { text: '-', isActive: false };
    }
  };

  const renderWarningBadges = () => {
    if (!scheduleMeta) return null;
    const badges = [];
    if (scheduleMeta.limitExceeded) {
      badges.push(
        <Chip key="limit" size="small" color="error" label="한도 초과" sx={{ fontWeight: 700 }} />
      );
    }
    if (scheduleMeta.queueDelayedMinutes) {
      badges.push(
        <Chip
          key="queue"
          size="small"
          color="warning"
          label={`대기열 지연 ${scheduleMeta.queueDelayedMinutes}분`}
          sx={{ fontWeight: 700 }}
        />
      );
    }
    if (badges.length === 0) return null;
    return (
      <Stack direction="row" spacing={0.75} flexWrap="wrap">
        {badges}
      </Stack>
    );
  };

  const onSubmit = async (data: ScheduleForm) => {
    setError(null);
    setSaveLoading(true);

    try {
      // API에 전송할 데이터 변환
      const scheduleData = {
        name: data.name,
        templateId: data.templateId,
        dailyPostCount: data.dailyPostCount,
        postIntervalMinutes: data.postIntervalMinutes,
        scheduleType: (data.scheduleType === 'immediate' ? 'IMMEDIATE' : 'SCHEDULED') as 'IMMEDIATE' | 'SCHEDULED',
        runTime: data.scheduleType === 'scheduled' ? data.runTime : '00:00',
      };

      let schedule;
      if (isNew) {
        schedule = await scheduleApi.create(scheduleData);
      } else {
        schedule = await scheduleApi.update(id, scheduleData);
      }

      // 저장 후 바로 실행 옵션 처리
      if (data.scheduleType === 'immediate') {
        try {
          await scheduleApi.runNow(schedule.id);
          toast.success('저장 완료 및 즉시 실행이 시작되었습니다!');
        } catch (runError) {
          if (runError instanceof ApiError && runError.message.includes('이미 실행되었습니다')) {
            toast.info('저장은 완료되었으나, 오늘은 이미 실행되어 중복 실행되지 않았습니다.');
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
  const postTimeList = getPostTimeList();

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

      {!isNew && scheduleMeta && (
        <AppCard sx={{ mb: 3, p: 0 }}>
          <Box
            sx={{
              p: 3,
              display: 'flex',
              gap: 3,
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Stack spacing={1.25} sx={{ minWidth: { xs: '100%', sm: 320 }, flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Schedule fontSize="small" color="primary" />
                실행 타임라인
              </Typography>

              <Stack spacing={1}>
                {(() => {
                  const next = getNextRunInfo();
                  if (!next) return null;
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AccessTime sx={{ fontSize: 18, color: next.isActive ? 'primary.main' : 'text.disabled' }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: next.isActive ? 'primary.main' : 'text.disabled' }}>
                          다음 실행 · {next.text}
                        </Typography>
                        {next.subText && (
                          <Typography variant="caption" color="text.secondary">
                            {next.subText}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })()}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {scheduleMeta.lastRunStatus === 'SUCCESS' && <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />}
                  {scheduleMeta.lastRunStatus === 'FAILED' && <ErrorIcon sx={{ fontSize: 18, color: 'error.main' }} />}
                  {!scheduleMeta.lastRunStatus && <Info sx={{ fontSize: 18, color: 'text.disabled' }} />}
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      최근 실행 · {scheduleMeta.lastRunStatus === 'SUCCESS' ? '성공' : scheduleMeta.lastRunStatus === 'FAILED' ? '실패' : '기록 없음'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatRelativeTime(scheduleMeta.lastRunFinishedAt || scheduleMeta.lastRunDate) || '-'}
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    icon={<Bolt sx={{ fontSize: 16 }} />}
                    label={`일일 실행 ${scheduleMeta.dailyRunCount ?? 0}회`}
                    sx={{ fontWeight: 700 }}
                  />
                  <Chip
                    size="small"
                    icon={<CalendarMonth sx={{ fontSize: 16 }} />}
                    label={`주간 실행 ${scheduleMeta.weeklyRunCount ?? 0}회`}
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
              </Stack>
            </Stack>

            <Stack spacing={1.5} alignItems="flex-end" sx={{ minWidth: { xs: '100%', sm: 240 } }}>
              {renderWarningBadges()}
              <Stack direction="row" spacing={1}>
                <AppButton
                  size="small"
                  variant={scheduleMeta.userEnabled ? 'outlined' : 'contained'}
                  startIcon={scheduleMeta.userEnabled ? <PauseCircle /> : <PlayCircle />}
                  disabled={actionLoading}
                  onClick={() =>
                    setActionTarget({
                      type: scheduleMeta.userEnabled ? 'pause' : 'resume',
                      schedule: scheduleMeta,
                    })
                  }
                >
                  {scheduleMeta.userEnabled ? '일시정지' : '재개'}
                </AppButton>
                <AppButton
                  size="small"
                  variant="contained"
                  startIcon={<PlayArrow />}
                  disabled={
                    !scheduleMeta.userEnabled ||
                    scheduleMeta.adminStatus !== 'APPROVED' ||
                    !sessionHealthy ||
                    actionLoading
                  }
                  onClick={() => setActionTarget({ type: 'run', schedule: scheduleMeta })}
                >
                  지금 실행
                </AppButton>
                <AppButton
                  size="small"
                  variant="text"
                  startIcon={<History />}
                  onClick={() => setFailureOpen(true)}
                >
                  실패 이력
                </AppButton>
              </Stack>
            </Stack>
          </Box>
        </AppCard>
      )}

      {!isNew && scheduleMeta && (scheduleMeta.limitExceeded || scheduleMeta.queueDelayedMinutes) && (
        <Alert
          severity={scheduleMeta.limitExceeded ? 'error' : 'warning'}
          icon={<WarningAmber />}
          sx={{ mb: 3, borderRadius: 2 }}
        >
          {scheduleMeta.limitExceeded
            ? '스케줄 호출 한도를 초과했습니다. 설정을 조정하거나 내일 다시 시도해주세요.'
            : `최근 대기열이 지연되고 있습니다 (${scheduleMeta.queueDelayedMinutes}분). 실행 결과 반영까지 시간이 걸릴 수 있습니다.`}
        </Alert>
      )}

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

          {/* 게시글 수 + 게시 간격 (2열) */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2.5,
              mb: 3,
            }}
          >
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

          <Divider sx={{ my: 3 }} />

          {/* 실행 타입 선택 (체크박스 형태) */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* 저장 후 바로 실행 */}
            <Controller
              name="scheduleType"
              control={control}
              render={({ field }) => (
                <Box
                  onClick={() => field.onChange('immediate')}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: field.value === 'immediate' ? 'success.main' : 'divider',
                    bgcolor: field.value === 'immediate' 
                      ? (theme) => alpha(theme.palette.success.main, 0.04)
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: field.value === 'immediate' ? 'success.main' : 'success.light',
                      bgcolor: (theme) => alpha(theme.palette.success.main, 0.04),
                    },
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === 'immediate'}
                        onChange={() => field.onChange('immediate')}
                        sx={{
                          color: 'success.main',
                          '&.Mui-checked': { color: 'success.main' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Bolt sx={{ fontSize: 20, color: field.value === 'immediate' ? 'success.main' : 'text.disabled' }} />
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            저장 후 바로 실행
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            저장 즉시 게시가 시작됩니다
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />
                </Box>
              )}
            />

            {/* 예약 설정 */}
            <Controller
              name="scheduleType"
              control={control}
              render={({ field }) => (
                <Box
                  onClick={() => field.onChange('scheduled')}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: field.value === 'scheduled' ? 'primary.main' : 'divider',
                    bgcolor: field.value === 'scheduled' 
                      ? (theme) => alpha(theme.palette.primary.main, 0.04)
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: field.value === 'scheduled' ? 'primary.main' : 'primary.light',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value === 'scheduled'}
                        onChange={() => field.onChange('scheduled')}
                        sx={{
                          color: 'primary.main',
                          '&.Mui-checked': { color: 'primary.main' },
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CalendarMonth sx={{ fontSize: 20, color: field.value === 'scheduled' ? 'primary.main' : 'text.disabled' }} />
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            예약 설정
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            매일 지정된 시간에 자동으로 게시됩니다
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ m: 0, width: '100%' }}
                  />

                  {/* 예약 설정 선택 시 시간 입력 UI 표시 */}
                  {field.value === 'scheduled' && (
                    <Box
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        mt: 2.5,
                        pt: 2.5,
                        borderTop: '1px dashed',
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <PlayArrow sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          시작 시간 설정
                        </Typography>
                      </Box>
                      <TextField
                        {...register('runTime')}
                        type="time"
                        error={!!errors.runTime}
                        helperText={errors.runTime?.message || '매일 이 시간에 자동으로 게시가 시작됩니다'}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          sx: {
                            borderRadius: 2,
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            minWidth: 180,
                            maxWidth: 200,
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                            '& input': { 
                              textAlign: 'center',
                              py: 1.5,
                            },
                          },
                        }}
                      />
                    </Box>
                  )}
                </Box>
              )}
            />
          </Box>

          {/* 실행 미리보기 - 설정이 유효할 때만 표시 */}
          {isExecutionSettingsValid && (
            <Box
              sx={{
                mt: 3,
                p: 3,
                borderRadius: 3,
                background: (theme) =>
                  scheduleType === 'immediate'
                    ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.success.main, 0.04)} 100%)`
                    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
                border: '2px solid',
                borderColor: (theme) =>
                  scheduleType === 'immediate'
                    ? alpha(theme.palette.success.main, 0.3)
                    : alpha(theme.palette.primary.main, 0.3),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CheckCircle
                  sx={{
                    fontSize: 22,
                    color: scheduleType === 'immediate' ? 'success.main' : 'primary.main',
                  }}
                />
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 700,
                    color: scheduleType === 'immediate' ? 'success.dark' : 'primary.dark',
                  }}
                >
                  실행 미리보기
                </Typography>
              </Box>

              {/* 즉시 실행 미리보기 */}
              {scheduleType === 'immediate' && (
                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      color: 'success.dark',
                      mb: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Bolt sx={{ fontSize: 28 }} />
                    저장 즉시 실행
                  </Typography>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: (theme) => alpha(theme.palette.success.main, 0.2),
                    }}
                  >
                    <Typography variant="body1" sx={{ fontWeight: 600, mb: 1.5 }}>
                      <Box component="span" sx={{ color: 'success.main', fontWeight: 700, fontSize: '1.25rem' }}>
                        {dailyPostCount}개
                      </Box>
                      의 게시글을{' '}
                      <Box component="span" sx={{ color: 'warning.main', fontWeight: 700, fontSize: '1.25rem' }}>
                        {postIntervalMinutes}분
                      </Box>{' '}
                      간격으로 게시
                    </Typography>

                    {/* 시간 정보 그리드 */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 2,
                        p: 2,
                        borderRadius: 1.5,
                        bgcolor: (theme) => alpha(theme.palette.success.main, 0.06),
                      }}
                    >
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          예상 시작 시간
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {getImmediateStartTime()}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          예상 종료 시간
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'error.main' }}>
                          {endTime || '-'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          총 소요 시간
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          약 {totalDuration}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* 예약 설정 미리보기 */}
              {scheduleType === 'scheduled' && (
                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 800,
                      color: 'primary.dark',
                      mb: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <CalendarMonth sx={{ fontSize: 28 }} />
                    매일{' '}
                    <Box
                      component="span"
                      sx={{
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1.5,
                        bgcolor: 'primary.main',
                        color: 'white',
                        fontSize: '1.5rem',
                      }}
                    >
                      {runTime}
                    </Box>{' '}
                    시작
                  </Typography>

                  {/* 타임라인 시각화 */}
                  {postTimeList && postTimeList.length > 0 && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        {postTimeList.map((time, idx) => (
                          <Box key={idx} sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box
                              sx={{
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 1.5,
                                bgcolor: idx === 0 ? 'primary.main' : (theme) => alpha(theme.palette.primary.main, 0.1),
                                color: idx === 0 ? 'white' : 'primary.dark',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                              }}
                            >
                              {time}
                            </Box>
                            {idx < postTimeList.length - 1 && (
                              <NavigateNext sx={{ color: 'text.disabled', mx: 0.5 }} />
                            )}
                          </Box>
                        ))}
                        {dailyPostCount > 4 && (
                          <>
                            <NavigateNext sx={{ color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              ... 외 {dailyPostCount - 4}개
                            </Typography>
                          </>
                        )}
                      </Box>

                      <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            예상 완료 시간
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {endTime}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            총 소요 시간
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            약 {totalDuration}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            게시글 수
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {dailyPostCount}개
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
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

      <ConfirmDialog
        open={!!actionTarget}
        title={
          actionTarget?.type === 'run'
            ? '스케줄을 지금 실행할까요?'
            : actionTarget?.type === 'pause'
              ? '스케줄을 일시정지할까요?'
              : '스케줄을 다시 실행할까요?'
        }
        message={
          actionTarget
            ? `"${actionTarget.schedule.name}" 스케줄을 ${actionTarget.type === 'run' ? '즉시 실행' : actionTarget.type === 'pause' ? '일시정지' : '재개'}합니다.`
            : ''
        }
        onConfirm={handleActionConfirm}
        onCancel={() => setActionTarget(null)}
        confirmText="확인"
      />

      {scheduleMeta && (
        <FailureHistoryDialog
          open={failureOpen}
          scheduleId={scheduleMeta.id}
          scheduleName={scheduleMeta.name}
          onClose={() => setFailureOpen(false)}
        />
      )}
    </Box>
  );
}
