/**
 * Dashboard 컨트롤러
 * 대시보드 API 엔드포인트
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import type {
  IntegrationStatusResponse,
  JobSummaryResponse,
  TodayTimelineResponse,
  NextRunResponse,
  FailureSummaryResponse,
  RecentResultsResponse,
} from './dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 연동 상태 조회
   * GET /api/dashboard/integration-status
   */
  @Get('integration-status')
  async getIntegrationStatus(
    @CurrentUser() user: RequestUser
  ): Promise<IntegrationStatusResponse> {
    return this.dashboardService.getIntegrationStatus(user.userId);
  }

  /**
   * 작업 요약 조회
   * GET /api/dashboard/job-summary
   */
  @Get('job-summary')
  async getJobSummary(@CurrentUser() user: RequestUser): Promise<JobSummaryResponse> {
    return this.dashboardService.getJobSummary(user.userId);
  }

  /**
   * 오늘 타임라인 조회
   * GET /api/dashboard/today-timeline
   */
  @Get('today-timeline')
  async getTodayTimeline(
    @CurrentUser() user: RequestUser
  ): Promise<TodayTimelineResponse> {
    return this.dashboardService.getTodayTimeline(user.userId);
  }

  /**
   * Next Run TOP N 조회
   * GET /api/dashboard/next-run?limit=3
   */
  @Get('next-run')
  async getNextRun(
    @CurrentUser() user: RequestUser,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number
  ): Promise<NextRunResponse> {
    return this.dashboardService.getNextRun(user.userId, Math.min(limit, 10));
  }

  /**
   * 실패 요약 조회
   * GET /api/dashboard/failure-summary?period=TODAY
   */
  @Get('failure-summary')
  async getFailureSummary(
    @CurrentUser() user: RequestUser,
    @Query('period') period?: 'TODAY' | 'WEEK'
  ): Promise<FailureSummaryResponse> {
    return this.dashboardService.getFailureSummary(user.userId, period || 'TODAY');
  }

  /**
   * 최근 결과 조회
   * GET /api/dashboard/recent-results?limit=10&filter=ALL
   */
  @Get('recent-results')
  async getRecentResults(
    @CurrentUser() user: RequestUser,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('filter') filter?: 'ALL' | 'SUCCESS' | 'FAILED'
  ): Promise<RecentResultsResponse> {
    return this.dashboardService.getRecentResults(
      user.userId,
      Math.min(limit, 50),
      filter || 'ALL'
    );
  }
}
