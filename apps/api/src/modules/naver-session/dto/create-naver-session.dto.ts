/**
 * 네이버 세션 생성 DTO
 * naverAccountId를 기준으로 세션 생성
 */

import { IsString } from 'class-validator';

export class CreateNaverSessionDto {
  /** 세션을 생성할 네이버 계정 ID */
  @IsString()
  naverAccountId: string;
}
