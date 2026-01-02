/**
 * 즉시 게시 DTO
 */

import { IsObject, IsOptional } from 'class-validator';

export class PostNowDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}













