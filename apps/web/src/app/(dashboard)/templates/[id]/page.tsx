'use client';

/**
 * 템플릿 상세/수정 페이지 - Premium Edition
 * 2열 레이아웃 + 새 템플릿 생성 시 이미지 동시 등록 지원
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Grid,
  Alert,
  IconButton,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  alpha,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Snackbar,
} from '@mui/material';
import {
  Save,
  ArrowBack,
  PlayArrow,
  CloudUpload,
  Delete,
  Preview,
  Close,
  Description,
  Image as ImageIcon,
  Settings,
  Store,
  Title,
  Article,
  Info,
  ChevronLeft,
  ChevronRight,
  LocalOffer,
  ExpandMore,
  ExpandLess,
  CheckCircle,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppButton from '@/components/common/AppButton';
import { templateApi, TemplateImage, ApiError } from '@/lib/api-client';

// ============================================
// 스키마
// ============================================

const templateSchema = z.object({
  name: z.string().min(1, '템플릿 이름을 입력하세요'),
  cafeId: z.string().min(1, '카페 ID를 입력하세요'),
  boardId: z.string().min(1, '게시판 ID를 입력하세요'),
  cafeName: z.string().optional(),
  boardName: z.string().optional(),
  subjectTemplate: z.string().min(1, '제목 템플릿을 입력하세요'),
  contentTemplate: z.string().min(1, '본문 템플릿을 입력하세요'),
  price: z.number().min(0).optional().nullable(),
  tradeMethod: z.string().optional().nullable(),
  tradeLocation: z.string().optional().nullable(),
});

type TemplateForm = z.infer<typeof templateSchema>;

// ============================================
// 로컬 이미지 프리뷰 타입 (새 템플릿용)
// ============================================
interface LocalImage {
  id: string;
  file: File;
  previewUrl: string;
}

// ============================================
// 이미지 업로더 (기존 템플릿 + 새 템플릿 모두 지원)
// ============================================

interface ImageUploaderProps {
  templateId?: string;
  images?: TemplateImage[];
  onImagesChange?: (images: TemplateImage[]) => void;
  localImages?: LocalImage[];
  onLocalImagesChange?: (images: LocalImage[]) => void;
  isNew?: boolean;
  disabled?: boolean;
}

function ImageUploader({
  templateId,
  images = [],
  onImagesChange,
  localImages = [],
  onLocalImagesChange,
  isNew = false,
  disabled = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentCount = isNew ? localImages.length : images.length;
  const maxImages = 10;

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled) return;
    
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      if (!file.type.startsWith('image/')) return false;
      if (file.size > 10 * 1024 * 1024) return false;
      return true;
    });

    if (validFiles.length === 0) {
      setError('유효한 이미지 파일이 없습니다');
      return;
    }

    if (currentCount + validFiles.length > maxImages) {
      setError(`이미지는 최대 ${maxImages}개까지 등록 가능합니다`);
      return;
    }

    setError(null);

    if (isNew) {
      const newLocalImages: LocalImage[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      onLocalImagesChange?.([...localImages, ...newLocalImages]);
    } else if (templateId) {
      setUploading(true);
      try {
        const result = await templateApi.uploadImages(templateId, validFiles);
        onImagesChange?.([...images, ...result.images]);
      } catch (err) {
        setError('업로드 실패');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = async (imageId: string) => {
    if (disabled) return;
    
    if (isNew) {
      const toRemove = localImages.find((img) => img.id === imageId);
      if (toRemove) URL.revokeObjectURL(toRemove.previewUrl);
      onLocalImagesChange?.(localImages.filter((img) => img.id !== imageId));
    } else if (templateId) {
      try {
        await templateApi.deleteImage(templateId, imageId);
        onImagesChange?.(images.filter((img) => img.id !== imageId));
      } catch (err) {
        setError('삭제 실패');
      }
    }
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (disabled) return;
    
    if (isNew) {
      const newImages = [...localImages];
      const [moved] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, moved);
      onLocalImagesChange?.(newImages);
    } else if (templateId) {
      const newImages = [...images];
      const [moved] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, moved);
      templateApi.reorderImages(templateId, newImages.map((img) => img.id)).catch(() => {});
      onImagesChange?.(newImages);
    }
  };

  const displayImages = isNew
    ? localImages.map((img) => ({ id: img.id, url: img.previewUrl }))
    : images.map((img) => ({ id: img.id, url: img.url }));

  return (
    <Box sx={{ opacity: disabled ? 0.6 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 2,
          textAlign: 'center',
          bgcolor: dragOver ? (theme) => alpha(theme.palette.primary.main, 0.04) : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          mb: displayImages.length > 0 ? 2 : 0,
        }}
        onClick={() => {
          if (disabled) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleFiles(files);
          };
          input.click();
        }}
      >
        <CloudUpload sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          클릭 또는 드래그하여 업로드
        </Typography>
        <Typography variant="caption" color="text.disabled">
          최대 {maxImages}개, 각 10MB
        </Typography>
      </Box>

      {uploading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}

      {displayImages.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {displayImages.map((image, index) => (
            <Box
              key={image.id}
              sx={{
                position: 'relative',
                width: 72,
                height: 72,
                borderRadius: 1.5,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover .actions': { opacity: disabled ? 0 : 1 },
              }}
            >
              <Box
                component="img"
                src={image.url}
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {index + 1}
              </Box>
              <Box
                className="actions"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                }}
              >
                {index > 0 && (
                  <IconButton
                    size="small"
                    sx={{ bgcolor: 'white', p: 0.25 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(index, index - 1);
                    }}
                  >
                    <ChevronLeft sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  sx={{ bgcolor: 'error.main', color: 'white', p: 0.25 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(image.id);
                  }}
                >
                  <Delete sx={{ fontSize: 14 }} />
                </IconButton>
                {index < displayImages.length - 1 && (
                  <IconButton
                    size="small"
                    sx={{ bgcolor: 'white', p: 0.25 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(index, index + 1);
                    }}
                  >
                    <ChevronRight sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ============================================
// 미리보기 다이얼로그
// ============================================

function PreviewDialog({
  open,
  onClose,
  title,
  content,
  images,
  localImages,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  images: TemplateImage[];
  localImages?: LocalImage[];
}) {
  const displayImages = localImages
    ? localImages.map((img) => ({ id: img.id, url: img.previewUrl }))
    : images.map((img) => ({ id: img.id, url: img.url }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Preview color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            미리보기
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          {title || '(제목 없음)'}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {displayImages.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {displayImages.map((image) => (
              <Box
                key={image.id}
                component="img"
                src={image.url}
                sx={{
                  height: 120,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            ))}
          </Box>
        )}
        <Box
          sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{
            __html: content.replace(/\n/g, '<br/>') || '(본문 없음)',
          }}
        />
      </DialogContent>
      <DialogActions>
        <AppButton variant="outlined" onClick={onClose}>
          닫기
        </AppButton>
      </DialogActions>
    </Dialog>
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<TemplateImage[]>([]);
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  // 중복 제출 방지용 ref
  const isSubmittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      cafeId: '',
      boardId: '',
      cafeName: '',
      boardName: '',
      subjectTemplate: '',
      contentTemplate: '',
      price: null,
      tradeMethod: '', // null이 아닌 빈 문자열로 설정 (MUI Select 호환)
      tradeLocation: '',
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    if (!isNew) loadTemplate();

    return () => {
      localImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
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
        price: template.price,
        tradeMethod: template.tradeMethod || '', // null을 빈 문자열로 변환
        tradeLocation: template.tradeLocation || '',
      });
      setImages(template.images || []);
      if (template.price || template.tradeMethod || template.tradeLocation) {
        setShowAdvanced(true);
      }
    } catch (error) {
      setError('템플릿을 불러올 수 없습니다');
    }
  };

  const onSubmit = async (data: TemplateForm) => {
    // 중복 제출 방지
    if (isSubmittingRef.current || saveLoading) {
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSaveLoading(true);

    try {
      // 빈 문자열을 null로 변환 (API 전송용)
      const submitData = {
        ...data,
        tradeMethod: data.tradeMethod || null,
        tradeLocation: data.tradeLocation || null,
      };

      if (isNew) {
        // 1. 템플릿 생성
        const created = await templateApi.create(submitData);

        // 2. 로컬 이미지가 있으면 업로드
        if (localImages.length > 0) {
          const files = localImages.map((img) => img.file);
          await templateApi.uploadImages(created.id, files);
        }

        // 3. 성공 - 템플릿 목록으로 이동
        setSnackbar({ open: true, message: '✅ 템플릿이 생성되었습니다' });
        setTimeout(() => {
          router.push('/templates');
        }, 500);
      } else {
        // 기존 템플릿 수정
        await templateApi.update(id, submitData);
        
        // 성공 - 템플릿 목록으로 이동
        setSnackbar({ open: true, message: '✅ 저장되었습니다' });
        setTimeout(() => {
          router.push('/templates');
        }, 500);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장 실패');
    } finally {
      setSaveLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handlePostNow = async () => {
    try {
      const result = await templateApi.postNow(id);
      setSnackbar({
        open: true,
        message: `✅ 게시 등록 완료! Job ID: ${result.jobId}`,
      });
    } catch (error) {
      setSnackbar({ open: true, message: '❌ 게시 요청 실패' });
    }
  };

  const systemVariables = [
    { key: '오늘날짜', ex: '2024-01-01' },
    { key: '오늘', ex: '2024년 01월 01일' },
    { key: '시간', ex: '14:30' },
    { key: '요일', ex: '월' },
  ];

  const currentImageCount = isNew ? localImages.length : images.length;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* 헤더 */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AppButton
              variant="text"
              startIcon={<ArrowBack />}
              onClick={() => router.push('/templates')}
              sx={{ ml: -1 }}
              disabled={saveLoading}
            >
              목록
            </AppButton>
            <Divider orientation="vertical" flexItem />
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              }}
            >
              <Description sx={{ fontSize: 20, color: 'white' }} />
            </Box>
            <Typography variant="h1" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {isNew ? '새 템플릿' : '템플릿 수정'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <AppButton
              variant="outlined"
              size="small"
              startIcon={<Preview />}
              onClick={() => setPreviewOpen(true)}
              disabled={saveLoading}
            >
              미리보기
            </AppButton>
            {!isNew && (
              <AppButton
                variant="outlined"
                size="small"
                startIcon={<PlayArrow />}
                onClick={handlePostNow}
                disabled={saveLoading}
              >
                지금 게시
              </AppButton>
            )}
            <AppButton
              variant="contained"
              size="small"
              startIcon={saveLoading ? undefined : <Save />}
              loading={saveLoading}
              onClick={handleSubmit(onSubmit)}
              disabled={saveLoading}
              sx={{
                minWidth: 80,
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
                },
                '&.Mui-disabled': {
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                  opacity: 0.7,
                },
              }}
            >
              {saveLoading ? '저장 중...' : '저장'}
            </AppButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* 2열 레이아웃 */}
        <Grid container spacing={2.5}>
          {/* 좌측: 기본 정보 + 이미지 */}
          <Grid item xs={12} lg={5}>
            {/* 기본 정보 */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                mb: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Store sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  기본 정보
                </Typography>
              </Box>

              <TextField
                {...register('name')}
                label="템플릿 이름"
                placeholder="예: 중고폰 판매 템플릿"
                fullWidth
                size="small"
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={{ mb: 2 }}
                InputProps={{ sx: { borderRadius: 1.5 } }}
                disabled={saveLoading}
              />

              <Grid container spacing={1.5}>
                <Grid item xs={6}>
                  <TextField
                    {...register('cafeId')}
                    label="카페 ID"
                    placeholder="10050146"
                    fullWidth
                    size="small"
                    error={!!errors.cafeId}
                    InputProps={{ sx: { borderRadius: 1.5 } }}
                    disabled={saveLoading}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    {...register('cafeName')}
                    label="카페 이름"
                    placeholder="중고나라"
                    fullWidth
                    size="small"
                    InputProps={{ sx: { borderRadius: 1.5 } }}
                    disabled={saveLoading}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    {...register('boardId')}
                    label="게시판 ID"
                    placeholder="1"
                    fullWidth
                    size="small"
                    error={!!errors.boardId}
                    InputProps={{ sx: { borderRadius: 1.5 } }}
                    disabled={saveLoading}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    {...register('boardName')}
                    label="게시판 이름"
                    placeholder="휴대폰"
                    fullWidth
                    size="small"
                    InputProps={{ sx: { borderRadius: 1.5 } }}
                    disabled={saveLoading}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* 이미지 */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                mb: 2.5,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ImageIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    이미지
                  </Typography>
                </Box>
                <Chip label={`${currentImageCount}/10`} size="small" />
              </Box>

              <ImageUploader
                templateId={isNew ? undefined : id}
                images={images}
                onImagesChange={setImages}
                localImages={localImages}
                onLocalImagesChange={setLocalImages}
                isNew={isNew}
                disabled={saveLoading}
              />
            </Box>

            {/* 고급 설정 - 접이식 */}
            <Box
              sx={{
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  cursor: saveLoading ? 'not-allowed' : 'pointer',
                  '&:hover': {
                    bgcolor: saveLoading ? 'transparent' : (theme) => alpha(theme.palette.action.hover, 0.5),
                  },
                }}
                onClick={() => !saveLoading && setShowAdvanced(!showAdvanced)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Settings sx={{ fontSize: 18, color: 'secondary.main' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    고급 설정
                  </Typography>
                  <Chip
                    label="선택"
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                {showAdvanced ? <ExpandLess /> : <ExpandMore />}
              </Box>

              <Collapse in={showAdvanced}>
                <Box sx={{ px: 2.5, pb: 2.5 }}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12}>
                      <TextField
                        {...register('price', { valueAsNumber: true })}
                        label="가격"
                        type="number"
                        fullWidth
                        size="small"
                        placeholder="0"
                        InputProps={{
                          sx: { borderRadius: 1.5 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <LocalOffer sx={{ fontSize: 18 }} />
                            </InputAdornment>
                          ),
                          endAdornment: <InputAdornment position="end">원</InputAdornment>,
                        }}
                        disabled={saveLoading}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Controller
                        name="tradeMethod"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth size="small" disabled={saveLoading}>
                            <InputLabel>거래 방법</InputLabel>
                            <Select
                              {...field}
                              value={field.value || ''}
                              label="거래 방법"
                              sx={{ borderRadius: 1.5 }}
                            >
                              <MenuItem value="">선택 안함</MenuItem>
                              <MenuItem value="DIRECT">직거래</MenuItem>
                              <MenuItem value="DELIVERY">택배</MenuItem>
                              <MenuItem value="BOTH">둘 다</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        {...register('tradeLocation')}
                        label="거래 지역"
                        fullWidth
                        size="small"
                        placeholder="서울 강남"
                        InputProps={{ sx: { borderRadius: 1.5 } }}
                        disabled={saveLoading}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Collapse>
            </Box>
          </Grid>

          {/* 우측: 템플릿 내용 */}
          <Grid item xs={12} lg={7}>
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Article sx={{ fontSize: 18, color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  템플릿 내용
                </Typography>
              </Box>

              <TextField
                {...register('subjectTemplate')}
                label="제목 템플릿"
                placeholder="[판매] {{상품명}} - {{오늘날짜}}"
                fullWidth
                size="small"
                error={!!errors.subjectTemplate}
                helperText={errors.subjectTemplate?.message}
                sx={{ mb: 2 }}
                InputProps={{
                  sx: { borderRadius: 1.5 },
                  startAdornment: (
                    <InputAdornment position="start">
                      <Title sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                disabled={saveLoading}
              />

              <TextField
                {...register('contentTemplate')}
                label="본문 템플릿"
                placeholder="게시글 본문을 입력하세요..."
                fullWidth
                multiline
                rows={14}
                error={!!errors.contentTemplate}
                helperText={errors.contentTemplate?.message}
                sx={{ flex: 1, mb: 2 }}
                InputProps={{ sx: { borderRadius: 1.5 } }}
                disabled={saveLoading}
              />

              {/* 시스템 변수 */}
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.04),
                  border: '1px solid',
                  borderColor: (theme) => alpha(theme.palette.info.main, 0.12),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Info sx={{ fontSize: 14, color: 'info.main' }} />
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: 'info.main', mr: 1 }}
                  >
                    변수:
                  </Typography>
                  {systemVariables.map((v) => (
                    <Chip
                      key={v.key}
                      label={`{{${v.key}}}`}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        borderColor: (theme) => alpha(theme.palette.info.main, 0.3),
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* 하단 저장 버튼 */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
            mt: 3,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <AppButton
            variant="outlined"
            onClick={() => router.push('/templates')}
            disabled={saveLoading}
          >
            취소
          </AppButton>
          <AppButton
            type="submit"
            variant="contained"
            startIcon={saveLoading ? undefined : <Save />}
            loading={saveLoading}
            disabled={saveLoading}
            sx={{
              minWidth: 140,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
              },
              '&.Mui-disabled': {
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                opacity: 0.7,
                color: 'white',
              },
            }}
          >
            {saveLoading ? '저장 중...' : isNew ? '템플릿 저장' : '저장'}
          </AppButton>
        </Box>
      </form>

      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={watchedValues.subjectTemplate || ''}
        content={watchedValues.contentTemplate || ''}
        images={images}
        localImages={isNew ? localImages : undefined}
      />

      {/* 성공/실패 알림 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ open: false, message: '' })}
          severity={snackbar.message.includes('❌') ? 'error' : 'success'}
          variant="filled"
          sx={{ width: '100%', borderRadius: 2 }}
          icon={snackbar.message.includes('❌') ? undefined : <CheckCircle />}
        >
          {snackbar.message.replace(/[✅❌]/g, '').trim()}
        </Alert>
      </Snackbar>
    </Box>
  );
}
