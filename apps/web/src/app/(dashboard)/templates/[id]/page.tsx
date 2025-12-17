'use client';

/**
 * 템플릿 상세/수정 페이지
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Box, Typography, TextField, Grid, Alert } from '@mui/material';
import { Save, ArrowBack, PlayArrow } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import { templateApi, ApiError } from '@/lib/api-client';

const templateSchema = z.object({
  name: z.string().min(1, '템플릿 이름을 입력하세요'),
  cafeId: z.string().min(1, '카페 ID를 입력하세요'),
  boardId: z.string().min(1, '게시판 ID를 입력하세요'),
  cafeName: z.string().optional(),
  boardName: z.string().optional(),
  subjectTemplate: z.string().min(1, '제목 템플릿을 입력하세요'),
  contentTemplate: z.string().min(1, '본문 템플릿을 입력하세요'),
});

type TemplateForm = z.infer<typeof templateSchema>;

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
  });

  useEffect(() => {
    if (!isNew) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      const template = await templateApi.get(id);
      reset({
        name: template.name,
        cafeId: template.cafeId,
        boardId: template.boardId,
        cafeName: template.cafeName || '',
        boardName: template.boardName || '',
        subjectTemplate: template.subjectTemplate,
        contentTemplate: template.contentTemplate,
      });
    } catch (error) {
      setError('템플릿을 불러올 수 없습니다');
    }
  };

  const onSubmit = async (data: TemplateForm) => {
    setError(null);
    setSaveLoading(true);

    try {
      if (isNew) {
        await templateApi.create(data);
      } else {
        await templateApi.update(id, data);
      }
      router.push('/templates');
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

  const handlePostNow = async () => {
    try {
      const result = await templateApi.postNow(id);
      alert(`게시 작업이 등록되었습니다. Job ID: ${result.jobId}`);
    } catch (error) {
      alert('게시 요청 실패');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <AppButton
          variant="text"
          startIcon={<ArrowBack />}
          onClick={() => router.push('/templates')}
        >
          목록으로
        </AppButton>
      </Box>

      <Typography variant="h1" sx={{ mb: 3 }}>
        {isNew ? '새 템플릿' : '템플릿 수정'}
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
                label="템플릿 이름"
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{ mb: 2 }}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    {...register('cafeId')}
                    label="카페 ID"
                    fullWidth
                    error={!!errors.cafeId}
                    helperText={errors.cafeId?.message}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField {...register('cafeName')} label="카페 이름 (선택)" fullWidth />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    {...register('boardId')}
                    label="게시판 ID"
                    fullWidth
                    error={!!errors.boardId}
                    helperText={errors.boardId?.message}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField {...register('boardName')} label="게시판 이름 (선택)" fullWidth />
                </Grid>
              </Grid>
            </AppCard>
          </Grid>

          {/* 템플릿 내용 */}
          <Grid item xs={12} md={6}>
            <AppCard title="템플릿 내용">
              <TextField
                {...register('subjectTemplate')}
                label="제목 템플릿"
                fullWidth
                error={!!errors.subjectTemplate}
                helperText={errors.subjectTemplate?.message || '{{변수}} 형식으로 변수 사용 가능'}
                sx={{ mb: 2 }}
              />
              <TextField
                {...register('contentTemplate')}
                label="본문 템플릿"
                fullWidth
                multiline
                rows={8}
                error={!!errors.contentTemplate}
                helperText={errors.contentTemplate?.message}
              />
            </AppCard>
          </Grid>

          {/* 버튼 영역 */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {!isNew && (
                <AppButton variant="outlined" startIcon={<PlayArrow />} onClick={handlePostNow}>
                  지금 게시
                </AppButton>
              )}
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
