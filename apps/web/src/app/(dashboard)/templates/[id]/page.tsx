'use client';

/**
 * 템플릿 상세/수정 페이지
 * - 기본 정보 편집
 * - 이미지 업로드 및 관리
 * - 미리보기 기능
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  TextField,
  Grid,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import {
  Save,
  ArrowBack,
  PlayArrow,
  CloudUpload,
  Delete,
  DragIndicator,
  Preview,
  Image as ImageIcon,
  Close,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppCard from '@/components/common/AppCard';
import AppButton from '@/components/common/AppButton';
import { templateApi, TemplateImage, ApiError } from '@/lib/api-client';

// ============================================
// 유효성 검증 스키마
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
  tradeMethod: z.enum(['DIRECT', 'DELIVERY', 'BOTH']).optional().nullable(),
  tradeLocation: z.string().optional().nullable(),
});

type TemplateForm = z.infer<typeof templateSchema>;

// ============================================
// 이미지 업로드 컴포넌트
// ============================================

interface ImageUploaderProps {
  templateId: string;
  images: TemplateImage[];
  onImagesChange: (images: TemplateImage[]) => void;
  disabled?: boolean;
}

function ImageUploader({ templateId, images, onImagesChange, disabled }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파일 업로드 처리
  const handleUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // 유효성 검사
    const validFiles = fileArray.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError('이미지 파일만 업로드할 수 있습니다');
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB 이하여야 합니다');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // 최대 개수 체크
    if (images.length + validFiles.length > 10) {
      setError('최대 10개의 이미지만 업로드할 수 있습니다');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await templateApi.uploadImages(templateId, validFiles);
      onImagesChange([...images, ...result.images]);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이미지 업로드에 실패했습니다');
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // 이미지 삭제
  const handleDeleteImage = async (imageId: string) => {
    try {
      await templateApi.deleteImage(templateId, imageId);
      onImagesChange(images.filter((img) => img.id !== imageId));
    } catch (err) {
      setError('이미지 삭제에 실패했습니다');
    }
  };

  // 이미지 순서 변경 (드래그로 변경 - 간단 버전)
  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...images];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    
    // 순서 저장
    const imageIds = newImages.map((img) => img.id);
    templateApi.reorderImages(templateId, imageIds).catch(() => {
      setError('이미지 순서 저장에 실패했습니다');
    });
    
    onImagesChange(newImages);
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 업로드 영역 */}
      <Box
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          mb: 2,
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => {
          if (disabled) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = 'image/*';
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files) handleUpload(files);
          };
          input.click();
        }}
      >
        <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          이미지를 드래그하여 업로드하거나 클릭하여 선택하세요
        </Typography>
        <Typography variant="caption" color="text.secondary">
          최대 10개, 각 10MB 이하 (JPG, PNG, GIF, WebP)
        </Typography>
      </Box>

      {/* 업로드 진행 표시 */}
      {uploading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="indeterminate" />
          <Typography variant="caption" color="text.secondary">
            업로드 중...
          </Typography>
        </Box>
      )}

      {/* 이미지 목록 */}
      {images.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            등록된 이미지 ({images.length}/10)
          </Typography>
          <Grid container spacing={1}>
            {images.map((image, index) => (
              <Grid item xs={6} sm={4} md={3} key={image.id}>
                <Box
                  sx={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 1,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover .image-actions': {
                      opacity: 1,
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={image.url}
                    alt={image.originalName}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  {/* 순서 표시 */}
                  <Chip
                    label={index + 1}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      bgcolor: 'primary.main',
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />
                  {/* 액션 버튼 */}
                  <Box
                    className="image-actions"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {index > 0 && (
                      <IconButton
                        size="small"
                        sx={{ color: 'white' }}
                        onClick={() => moveImage(index, index - 1)}
                      >
                        <Typography variant="caption">◀</Typography>
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      sx={{ color: 'error.main', bgcolor: 'white' }}
                      onClick={() => handleDeleteImage(image.id)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                    {index < images.length - 1 && (
                      <IconButton
                        size="small"
                        sx={{ color: 'white' }}
                        onClick={() => moveImage(index, index + 1)}
                      >
                        <Typography variant="caption">▶</Typography>
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {image.originalName}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ============================================
// 미리보기 다이얼로그
// ============================================

interface PreviewDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  images: TemplateImage[];
}

function PreviewDialog({ open, onClose, title, content, images }: PreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Preview />
          게시글 미리보기
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* 제목 */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          {title || '(제목 없음)'}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {/* 이미지 */}
        {images.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Grid container spacing={1}>
              {images.map((image) => (
                <Grid item xs={12} sm={6} key={image.id}>
                  <Box
                    component="img"
                    src={image.url}
                    alt={image.originalName}
                    sx={{
                      width: '100%',
                      maxHeight: 300,
                      objectFit: 'contain',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* 본문 */}
        <Box
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.8,
          }}
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
// 메인 페이지 컴포넌트
// ============================================

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const isNew = id === 'new';

  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [images, setImages] = useState<TemplateImage[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      price: null,
      tradeMethod: null,
      tradeLocation: null,
    },
  });

  // 현재 값 감시 (미리보기용)
  const watchedValues = watch();

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
        price: template.price,
        tradeMethod: template.tradeMethod,
        tradeLocation: template.tradeLocation,
      });
      setImages(template.images || []);
    } catch (error) {
      setError('템플릿을 불러올 수 없습니다');
    }
  };

  const onSubmit = async (data: TemplateForm) => {
    setError(null);
    setSaveLoading(true);

    try {
      if (isNew) {
        const created = await templateApi.create(data);
        // 새로 생성 후 해당 페이지로 이동 (이미지 업로드를 위해)
        router.replace(`/templates/${created.id}`);
      } else {
        await templateApi.update(id, data);
      }
      // 저장 후 목록으로 이동하지 않고 현재 페이지 유지
      if (!isNew) {
        await loadTemplate();
      }
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
      alert(`게시 작업이 등록되었습니다.\n\n제목: ${result.preview.title}\n이미지: ${result.preview.imageCount}개\n\nJob ID: ${result.jobId}`);
    } catch (error) {
      alert('게시 요청 실패');
    }
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AppButton
            variant="text"
            startIcon={<ArrowBack />}
            onClick={() => router.push('/templates')}
          >
            목록으로
          </AppButton>
          <Typography variant="h1">
            {isNew ? '새 템플릿' : '템플릿 수정'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!isNew && (
            <>
              <AppButton
                variant="outlined"
                startIcon={<Preview />}
                onClick={() => setPreviewOpen(true)}
              >
                미리보기
              </AppButton>
              <AppButton
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={handlePostNow}
              >
                지금 게시
              </AppButton>
            </>
          )}
          <AppButton
            variant="contained"
            startIcon={<Save />}
            loading={saveLoading}
            onClick={handleSubmit(onSubmit)}
          >
            저장
          </AppButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 탭 */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="기본 정보" />
        <Tab label={`이미지 (${images.length})`} disabled={isNew} />
        <Tab label="고급 설정" disabled={isNew} />
      </Tabs>

      {/* 탭 0: 기본 정보 */}
      {activeTab === 0 && (
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
                      label="카페 ID (clubid)"
                      fullWidth
                      error={!!errors.cafeId}
                      helperText={errors.cafeId?.message || '예: 10050146'}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      {...register('cafeName')}
                      label="카페 이름 (선택)"
                      fullWidth
                      placeholder="예: 중고나라"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      {...register('boardId')}
                      label="게시판 ID (menuid)"
                      fullWidth
                      error={!!errors.boardId}
                      helperText={errors.boardId?.message}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      {...register('boardName')}
                      label="게시판 이름 (선택)"
                      fullWidth
                      placeholder="예: 휴대폰"
                    />
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
                  helperText={
                    errors.subjectTemplate?.message ||
                    '{{변수명}} 형식으로 변수 사용 가능. 예: {{상품명}} {{가격}}원'
                  }
                  sx={{ mb: 2 }}
                />
                <TextField
                  {...register('contentTemplate')}
                  label="본문 템플릿"
                  fullWidth
                  multiline
                  rows={10}
                  error={!!errors.contentTemplate}
                  helperText={errors.contentTemplate?.message}
                />
              </AppCard>
            </Grid>

            {/* 변수 안내 */}
            <Grid item xs={12}>
              <AppCard title="사용 가능한 시스템 변수">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[
                    { key: '오늘날짜', desc: '2024-01-01' },
                    { key: '오늘', desc: '2024년 01월 01일' },
                    { key: '년도', desc: '2024' },
                    { key: '월', desc: '01' },
                    { key: '일', desc: '01' },
                    { key: '시간', desc: '14:30' },
                    { key: '요일', desc: '월' },
                  ].map((v) => (
                    <Chip
                      key={v.key}
                      label={`{{${v.key}}} → ${v.desc}`}
                      variant="outlined"
                      size="small"
                    />
                  ))}
                </Box>
              </AppCard>
            </Grid>
          </Grid>
        </form>
      )}

      {/* 탭 1: 이미지 */}
      {activeTab === 1 && !isNew && (
        <AppCard title="이미지 관리" subtitle="게시글에 첨부할 이미지를 등록하세요">
          <ImageUploader
            templateId={id}
            images={images}
            onImagesChange={setImages}
          />
        </AppCard>
      )}

      {/* 탭 2: 고급 설정 (상품 게시판용) */}
      {activeTab === 2 && !isNew && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <AppCard title="상품 게시판 설정" subtitle="중고거래 게시판용 추가 정보">
              <TextField
                {...register('price', { valueAsNumber: true })}
                label="가격"
                type="number"
                fullWidth
                placeholder="예: 500000"
                InputProps={{
                  endAdornment: <Typography color="text.secondary">원</Typography>,
                }}
                sx={{ mb: 2 }}
              />
              <TextField
                {...register('tradeMethod')}
                label="거래 방법"
                select
                fullWidth
                SelectProps={{ native: true }}
                sx={{ mb: 2 }}
              >
                <option value="">선택 안함</option>
                <option value="DIRECT">직거래</option>
                <option value="DELIVERY">택배</option>
                <option value="BOTH">둘 다 가능</option>
              </TextField>
              <TextField
                {...register('tradeLocation')}
                label="거래 지역"
                fullWidth
                placeholder="예: 서울 강남구"
              />
            </AppCard>
          </Grid>
        </Grid>
      )}

      {/* 미리보기 다이얼로그 */}
      <PreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={watchedValues.subjectTemplate || ''}
        content={watchedValues.contentTemplate || ''}
        images={images}
      />
    </Box>
  );
}
