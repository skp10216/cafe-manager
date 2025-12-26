/**
 * Upload 서비스
 * 파일 업로드/삭제/관리 로직
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, basename } from 'path';
import { existsSync, unlinkSync, mkdirSync, statSync } from 'fs';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';

/** 업로드된 파일 정보 */
export interface UploadedFileInfo {
  filename: string;       // 저장된 파일명 (UUID)
  originalName: string;   // 원본 파일명
  mimeType: string;       // MIME 타입
  size: number;           // 파일 크기 (bytes)
  path: string;           // 저장 경로 (절대 경로)
  url: string;            // 접근 URL
  width?: number;         // 이미지 너비 (선택)
  height?: number;        // 이미지 높이 (선택)
}

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // 업로드 디렉토리 설정
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') || 
      join(process.cwd(), 'uploads');
    
    // API 베이스 URL (파일 접근용)
    this.baseUrl = this.configService.get<string>('API_BASE_URL') || 
      'http://localhost:3001';
    
    // 기본 업로드 디렉토리 생성
    this.ensureDirectory(this.uploadDir);
  }

  /**
   * 디렉토리 존재 확인 및 생성
   */
  private ensureDirectory(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 사용자별 업로드 디렉토리 경로 반환
   */
  getUserUploadDir(userId: string): string {
    return join(this.uploadDir, userId);
  }

  /**
   * 템플릿별 업로드 디렉토리 경로 반환
   */
  getTemplateUploadDir(userId: string, templateId: string): string {
    return join(this.uploadDir, userId, templateId);
  }

  /**
   * Multer로 업로드된 파일 정보 변환
   * @param file Multer 파일 객체
   * @param userId 사용자 ID
   * @returns 변환된 파일 정보
   */
  processUploadedFile(file: Express.Multer.File, userId: string): UploadedFileInfo {
    const relativePath = `${userId}/${file.filename}`;
    
    return {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      url: `${this.baseUrl}/uploads/${relativePath}`,
    };
  }

  /**
   * 여러 파일 정보 변환
   */
  processUploadedFiles(files: Express.Multer.File[], userId: string): UploadedFileInfo[] {
    return files.map(file => this.processUploadedFile(file, userId));
  }

  /**
   * 파일을 템플릿 디렉토리로 이동
   * @param currentPath 현재 파일 경로
   * @param userId 사용자 ID
   * @param templateId 템플릿 ID
   * @returns 새 파일 경로
   */
  async moveFileToTemplate(
    currentPath: string,
    userId: string,
    templateId: string,
  ): Promise<{ newPath: string; url: string }> {
    const filename = basename(currentPath);
    const templateDir = this.getTemplateUploadDir(userId, templateId);
    
    // 템플릿 디렉토리 생성
    this.ensureDirectory(templateDir);
    
    const newPath = join(templateDir, filename);
    
    // 파일이 이미 같은 위치에 있으면 이동 불필요
    if (currentPath !== newPath) {
      // 파일 이동 (복사 후 삭제)
      const content = await readFile(currentPath);
      await writeFile(newPath, content);
      
      // 원본 삭제
      if (existsSync(currentPath)) {
        unlinkSync(currentPath);
      }
    }
    
    const relativePath = `${userId}/${templateId}/${filename}`;
    const url = `${this.baseUrl}/uploads/${relativePath}`;
    
    return { newPath, url };
  }

  /**
   * 파일 삭제
   * @param filePath 파일 경로
   * @returns 삭제 성공 여부
   */
  deleteFile(filePath: string): boolean {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`파일 삭제 실패: ${filePath}`, error);
      return false;
    }
  }

  /**
   * 여러 파일 삭제
   */
  deleteFiles(filePaths: string[]): { success: string[]; failed: string[] } {
    const result = { success: [] as string[], failed: [] as string[] };
    
    for (const path of filePaths) {
      if (this.deleteFile(path)) {
        result.success.push(path);
      } else {
        result.failed.push(path);
      }
    }
    
    return result;
  }

  /**
   * 파일 존재 여부 확인
   */
  fileExists(filePath: string): boolean {
    return existsSync(filePath);
  }

  /**
   * 파일 크기 확인
   */
  getFileSize(filePath: string): number | null {
    try {
      const stats = statSync(filePath);
      return stats.size;
    } catch {
      return null;
    }
  }

  /**
   * URL에서 파일 경로 추출
   * @param url 파일 URL
   * @returns 파일 시스템 경로
   */
  getPathFromUrl(url: string): string | null {
    try {
      // URL에서 /uploads/ 이후 경로 추출
      const match = url.match(/\/uploads\/(.+)$/);
      if (!match) return null;
      
      const relativePath = match[1];
      return join(this.uploadDir, relativePath);
    } catch {
      return null;
    }
  }

  /**
   * 파일 유효성 검증
   */
  validateFile(file: Express.Multer.File): void {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `허용되지 않는 파일 형식입니다. 허용: ${allowedTypes.join(', ')}`,
      );
    }
    
    if (file.size > maxSize) {
      throw new BadRequestException(
        `파일 크기가 너무 큽니다. 최대: ${maxSize / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * 여러 파일 유효성 검증
   */
  validateFiles(files: Express.Multer.File[], maxCount: number = 10): void {
    if (files.length > maxCount) {
      throw new BadRequestException(
        `최대 ${maxCount}개의 이미지만 업로드할 수 있습니다.`,
      );
    }
    
    files.forEach(file => this.validateFile(file));
  }
}


