/**
 * 템플릿 이미지 관련 DTO
 */

import {
  IsString,
  IsInt,
  IsArray,
  IsOptional,
  Min,
  ArrayMinSize,
} from 'class-validator';

/**
 * 이미지 순서 변경 DTO
 */
export class ReorderImagesDto {
  @IsArray()
  @ArrayMinSize(1, { message: '최소 1개 이상의 이미지 ID가 필요합니다' })
  @IsString({ each: true })
  imageIds: string[];
}

/**
 * 이미지 정보 응답 DTO
 */
export class TemplateImageResponseDto {
  id: string;
  templateId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  width: number | null;
  height: number | null;
  order: number;
  createdAt: Date;
}

/**
 * 이미지 업로드 응답 DTO
 */
export class UploadImagesResponseDto {
  message: string;
  images: TemplateImageResponseDto[];
  totalCount: number;
}

/**
 * 이미지 삭제 응답 DTO
 */
export class DeleteImageResponseDto {
  message: string;
  deletedId: string;
}


