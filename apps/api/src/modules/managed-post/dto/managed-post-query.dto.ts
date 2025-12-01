/**
 * 게시글 목록 쿼리 DTO
 */

import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { ManagedPostStatus } from '@prisma/client';

export class ManagedPostQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  cafeId?: string;

  @IsOptional()
  @IsString()
  boardId?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'DELETED', 'UNKNOWN'])
  status?: ManagedPostStatus;
}

