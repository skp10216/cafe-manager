/**
 * Job 컨트롤러
 * 작업 목록 조회 API
 */

import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JobService } from './job.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { JobQueryDto } from './dto/job-query.dto';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobController {
  constructor(private readonly jobService: JobService) {}

  /**
   * 작업 목록 조회
   * GET /api/jobs
   */
  @Get()
  async findAll(@CurrentUser() user: RequestUser, @Query() query: JobQueryDto) {
    return this.jobService.findAll(user.userId, query);
  }

  /**
   * 작업 상세 조회
   * GET /api/jobs/:id
   */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.jobService.findOne(id, user.userId);
  }

  /**
   * 작업 로그 조회
   * GET /api/jobs/:id/logs
   */
  @Get(':id/logs')
  async findLogs(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.jobService.findLogs(id, user.userId);
  }

  /**
   * 최근 작업 요약 (대시보드용)
   * GET /api/jobs/summary/recent
   */
  @Get('summary/recent')
  async getRecentSummary(@CurrentUser() user: RequestUser) {
    return this.jobService.getRecentSummary(user.userId);
  }
}









