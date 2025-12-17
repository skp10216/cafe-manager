/**
 * 스케줄 생성 DTO
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty({ message: '템플릿을 선택하세요' })
  templateId: string;

  @IsString()
  @IsNotEmpty({ message: '스케줄 이름을 입력하세요' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  cronExpr?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: '실행 간격은 최소 1분 이상이어야 합니다' })
  intervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPostsPerDay?: number = 10;
}









