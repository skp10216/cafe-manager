/**
 * ScheduleRun 컨트롤러
 * 스케줄 실행 이력 API
 */

import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ScheduleRunService } from './schedule-run.service';

@Controller('schedule-runs')
@UseGuards(JwtAuthGuard)
export class ScheduleRunController {
  constructor(private readonly scheduleRunService: ScheduleRunService) {}

  /**
   * 스케줄별 실행 이력 조회
   * GET /schedule-runs/schedule/:scheduleId?page=1&limit=20
   */
  @Get('schedule/:scheduleId')
  async getRunsBySchedule(
    @Param('scheduleId') scheduleId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.scheduleRunService.findBySchedule(
      scheduleId,
      page || 1,
      limit || 20
    );
  }

  /**
   * Run의 Job 목록 조회
   * GET /schedule-runs/:runId/jobs
   */
  @Get(':runId/jobs')
  async getJobsByRun(@Param('runId') runId: string) {
    return this.scheduleRunService.findJobsByRun(runId);
  }
}
