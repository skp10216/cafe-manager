/**
 * Job 삭제 요청 DTO
 */

import { IsArray, IsString, IsOptional, IsEnum } from 'class-validator';

/** 삭제 필터 타입 */
export enum DeleteFilterType {
  ALL = 'ALL',           // 전체 삭제
  COMPLETED = 'COMPLETED', // 완료된 작업만
  FAILED = 'FAILED',     // 실패한 작업만
  OLD = 'OLD',           // 오래된 작업 (30일 이상)
}

/**
 * 선택 삭제 DTO
 */
export class DeleteJobsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

/**
 * 필터 기반 삭제 DTO
 */
export class DeleteJobsByFilterDto {
  @IsEnum(DeleteFilterType)
  filter: DeleteFilterType;

  @IsOptional()
  @IsString()
  beforeDate?: string; // ISO date string (OLD 필터용)
}

/**
 * 삭제 결과 응답
 */
export interface DeleteJobsResult {
  deletedCount: number;
  message: string;
}

