/**
 * 네이버 세션 생성 DTO
 */

import { IsString, IsOptional } from 'class-validator';

export class CreateNaverSessionDto {
  @IsOptional()
  @IsString()
  naverId?: string;
}




