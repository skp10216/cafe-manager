/**
 * Job 컨트롤러
 * 작업 목록 조회 및 삭제 API
 */

import { Controller, Get, Post, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { JobService } from './job.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { JobQueryDto } from './dto/job-query.dto';
import { DeleteJobsDto, DeleteJobsByFilterDto } from './dto/delete-jobs.dto';

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
   * 최근 작업 요약 (대시보드용)
   * GET /api/jobs/summary/recent
   * 
   * ⚠️ 주의: :id 파라미터 라우트보다 먼저 정의해야 함
   */
  @Get('summary/recent')
  async getRecentSummary(@CurrentUser() user: RequestUser) {
    return this.jobService.getRecentSummary(user.userId);
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

  // ========================================
  // 삭제 API
  // ========================================

  /**
   * 선택한 작업들 삭제 (다중 삭제)
   * POST /api/jobs/delete
   * 
   * Body: { ids: string[] }
   */
  @Post('delete')
  async deleteByIds(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteJobsDto
  ) {
    return this.jobService.deleteByIds(user.userId, dto.ids);
  }

  /**
   * 필터 기반 작업 삭제 (전체/완료/실패/오래된 작업)
   * POST /api/jobs/delete-by-filter
   * 
   * Body: { filter: 'ALL' | 'COMPLETED' | 'FAILED' | 'OLD', beforeDate?: string }
   */
  @Post('delete-by-filter')
  async deleteByFilter(
    @CurrentUser() user: RequestUser,
    @Body() dto: DeleteJobsByFilterDto
  ) {
    return this.jobService.deleteByFilter(user.userId, dto.filter, dto.beforeDate);
  }

  /**
   * 단일 작업 삭제
   * DELETE /api/jobs/:id
   */
  @Delete(':id')
  async deleteOne(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string
  ) {
    return this.jobService.deleteOne(user.userId, id);
  }
}











