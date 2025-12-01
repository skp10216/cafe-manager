/**
 * 토큰 갱신 요청 DTO
 */

import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh 토큰이 필요합니다' })
  refreshToken: string;
}

