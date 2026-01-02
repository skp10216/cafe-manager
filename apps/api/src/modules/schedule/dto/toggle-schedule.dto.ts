/**
 * 스케줄 상태 토글 DTO
 */

import { IsEnum } from 'class-validator';
import { ScheduleStatus } from '@prisma/client';

export class ToggleScheduleDto {
  @IsEnum(['ACTIVE', 'PAUSED'], {
    message: '상태는 ACTIVE 또는 PAUSED만 가능합니다',
  })
  status: ScheduleStatus;
}













