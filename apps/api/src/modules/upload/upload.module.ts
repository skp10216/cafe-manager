/**
 * Upload 모듈
 * 파일 업로드 처리를 위한 공통 모듈
 */

import { Module, Global } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { UploadService } from './upload.service';

/** 허용되는 이미지 MIME 타입 */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** 최대 파일 크기 (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 템플릿당 최대 이미지 개수 */
export const MAX_IMAGES_PER_TEMPLATE = 10;

/**
 * Multer 저장소 설정
 * - uploads/{userId}/{templateId}/ 구조로 저장
 * - UUID 기반 파일명으로 저장
 */
const multerStorage = diskStorage({
  destination: (req, _file, cb) => {
    // 기본 업로드 디렉토리
    const baseDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    
    // 사용자별 디렉토리 (인증된 사용자 ID 사용)
    const userId = (req as any).user?.userId || 'anonymous';
    const uploadPath = join(baseDir, userId);
    
    // 디렉토리가 없으면 생성
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    // UUID + 원본 확장자로 파일명 생성
    const ext = extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

/**
 * Multer 파일 필터
 * - 허용된 이미지 타입만 업로드 가능
 */
const multerFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `허용되지 않는 파일 형식입니다. 허용: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      ),
      false,
    );
  }
};

@Global()
@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: multerStorage,
        fileFilter: multerFileFilter,
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: MAX_IMAGES_PER_TEMPLATE,
        },
      }),
    }),
  ],
  providers: [UploadService],
  exports: [UploadService, MulterModule],
})
export class UploadModule {}
