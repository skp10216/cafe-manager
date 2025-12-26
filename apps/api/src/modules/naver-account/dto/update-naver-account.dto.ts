/**
 * 네이버 계정 수정 DTO
 */

import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateNaverAccountDto {
  /** 네이버 비밀번호 (평문 - API에서 암호화 처리) */
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해주세요' })
  password?: string;

  /** 표시 이름 */
  @IsOptional()
  @IsString()
  displayName?: string;
}








