/**
 * 네이버 계정 생성 DTO
 */

import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateNaverAccountDto {
  /** 네이버 로그인 아이디 */
  @IsString()
  @MinLength(1, { message: '네이버 아이디를 입력해주세요' })
  loginId: string;

  /** 네이버 비밀번호 (평문 - API에서 암호화 처리) */
  @IsString()
  @MinLength(1, { message: '비밀번호를 입력해주세요' })
  password: string;

  /** 표시 이름 (선택) */
  @IsOptional()
  @IsString()
  displayName?: string;
}










