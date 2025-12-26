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
  Matches,
  IsEnum,
  ValidateIf,
} from 'class-validator';

/** 스케줄 타입: 즉시 실행 / 예약 설정 */
export enum ScheduleType {
  IMMEDIATE = 'IMMEDIATE', // 저장 후 바로 실행
  SCHEDULED = 'SCHEDULED', // 예약 설정 (매일 지정 시간)
}

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty({ message: '템플릿을 선택하세요' })
  templateId: string;

  @IsString()
  @IsNotEmpty({ message: '스케줄 이름을 입력하세요' })
  @MaxLength(100)
  name: string;

  /** 스케줄 타입 (IMMEDIATE: 즉시 실행, SCHEDULED: 예약 설정) */
  @IsOptional()
  @IsEnum(ScheduleType, { message: '스케줄 타입은 IMMEDIATE 또는 SCHEDULED만 가능합니다' })
  scheduleType?: ScheduleType;

  /** 실행 시간 (HH:mm 형식, 예: "09:00") - SCHEDULED 타입에서만 필수 */
  @ValidateIf((o) => o.scheduleType !== ScheduleType.IMMEDIATE)
  @IsString()
  @IsNotEmpty({ message: '실행 시간을 입력하세요' })
  @Matches(/^\d{2}:\d{2}$/, { message: '실행 시간은 HH:mm 형식이어야 합니다 (예: 09:00)' })
  runTime?: string;

  /** 하루 게시글 수 (기본값: 10) */
  @IsOptional()
  @IsInt()
  @Min(1, { message: '하루 게시글 수는 최소 1개 이상이어야 합니다' })
  @Max(100, { message: '하루 게시글 수는 최대 100개까지 가능합니다' })
  dailyPostCount?: number;

  /** 게시글 간격 (분, 기본값: 5) */
  @IsOptional()
  @IsInt()
  @Min(1, { message: '게시글 간격은 최소 1분 이상이어야 합니다' })
  @Max(60, { message: '게시글 간격은 최대 60분까지 가능합니다' })
  postIntervalMinutes?: number;

  /** 타임존 (기본값: Asia/Seoul) */
  @IsOptional()
  @IsString()
  timezone?: string;
}










