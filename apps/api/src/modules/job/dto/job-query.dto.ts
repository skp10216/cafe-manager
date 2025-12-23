/**
 * Job 목록 쿼리 DTO
 */

import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { JobType, JobStatus } from '@prisma/client';

export class JobQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(['INIT_SESSION', 'CREATE_POST', 'SYNC_POSTS', 'DELETE_POST'])
  type?: JobType;

  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])
  status?: JobStatus;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value ? new Date(value).toISOString() : undefined))
  dateTo?: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  scheduleName?: string;
}









