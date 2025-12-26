/**
 * Worker Monitor Controller
 * Admin 전용 워커 모니터링 API
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  Req,
} from '@nestjs/common';
import { JobState } from 'bullmq';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { WorkerMonitorService } from './worker-monitor.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { IncidentService } from './incident.service';
import { Request } from 'express';
import { IncidentStatus, IncidentType } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string; role: string };
}

@Controller('admin/worker-monitor')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WorkerMonitorController {
  private readonly logger = new Logger(WorkerMonitorController.name);

  constructor(
    private readonly service: WorkerMonitorService,
    private readonly heartbeatService: WorkerHeartbeatService,
    private readonly incidentService: IncidentService,
  ) {}

  // ============================================
  // P0: 조회 API
  // ============================================

  /**
   * Overview - KPI 통계 + Active Incidents
   * 대시보드 상단 KPI 카드 데이터
   */
  @Get('overview')
  async getOverview() {
    return this.service.getOverview();
  }

  /**
   * 큐 목록 + 현재 상태
   */
  @Get('queues')
  async getQueues() {
    return this.service.getQueues();
  }

  /**
   * 큐 상세 정보
   */
  @Get('queues/:name')
  async getQueueDetail(@Param('name') name: string) {
    return this.service.getQueueDetail(name);
  }

  /**
   * 큐 트렌드 (시계열 데이터)
   * @param name 큐 이름
   * @param hours 조회 기간 (기본 1시간)
   */
  @Get('queues/:name/trend')
  async getQueueTrend(
    @Param('name') name: string,
    @Query('hours') hours?: string,
  ) {
    const hoursNum = hours ? parseInt(hours, 10) : 1;
    return this.service.getQueueTrend(name, hoursNum);
  }

  /**
   * 워커 목록 (Redis ZSET 기반)
   */
  @Get('workers')
  async getWorkers() {
    const workers = await this.heartbeatService.getOnlineWorkers();
    const totalCount = await this.heartbeatService.getTotalWorkerCount();

    return {
      workers,
      summary: {
        online: workers.length,
        total: totalCount,
      },
    };
  }

  /**
   * 워커 상세 정보
   */
  @Get('workers/:workerId')
  async getWorkerDetail(@Param('workerId') workerId: string) {
    return this.heartbeatService.getWorkerInfo(workerId);
  }

  // ============================================
  // P1: Queue Actions
  // ============================================

  /**
   * 큐 일시정지
   * ⚠️ 위험 작업: 새 작업이 처리되지 않음
   */
  @Post('queues/:name/pause')
  async pauseQueue(
    @Param('name') name: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.pauseQueue(name, req.user.sub, reason);
  }

  /**
   * 큐 재개
   */
  @Post('queues/:name/resume')
  async resumeQueue(
    @Param('name') name: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.resumeQueue(name, req.user.sub, reason);
  }

  /**
   * 실패한 작업 일괄 재시도
   */
  @Post('queues/:name/retry-failed')
  async retryFailedJobs(
    @Param('name') name: string,
    @Query('limit') limit?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.service.retryFailedJobs(name, req?.user?.sub || 'unknown', limitNum);
  }

  /**
   * 대기 중인 작업 전체 제거 (Drain)
   * ⚠️ 위험 작업: 복구 불가
   */
  @Delete('queues/:name/drain')
  async drainQueue(
    @Param('name') name: string,
    @Query('delayed') delayed?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const includeDelayed = delayed !== 'false';
    return this.service.drainQueue(name, req?.user?.sub || 'unknown', includeDelayed);
  }

  /**
   * 완료/실패 작업 정리 (Clean)
   */
  @Delete('queues/:name/clean')
  async cleanQueue(
    @Param('name') name: string,
    @Query('status') status?: 'completed' | 'failed',
    @Query('grace') grace?: string,
    @Query('limit') limit?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const graceMs = grace ? parseInt(grace, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    return this.service.cleanQueue(
      name,
      req?.user?.sub || 'unknown',
      status || 'completed',
      graceMs,
      limitNum
    );
  }

  // ============================================
  // P1: Jobs API
  // ============================================

  /**
   * Job 목록 조회
   */
  @Get('queues/:name/jobs')
  async getJobs(
    @Param('name') name: string,
    @Query('status') status?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('asc') asc?: string,
  ) {
    return this.service.getJobs(name, {
      status: (status as JobState | 'all') || 'all',
      start: start ? parseInt(start, 10) : 0,
      end: end ? parseInt(end, 10) : 49,
      asc: asc === 'true',
    });
  }

  /**
   * Job 상세 조회
   */
  @Get('queues/:name/jobs/:jobId')
  async getJobDetail(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
  ) {
    return this.service.getJobDetail(name, jobId);
  }

  /**
   * Job 재시도
   */
  @Post('queues/:name/jobs/:jobId/retry')
  async retryJob(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.retryJob(name, jobId, req.user.sub);
  }

  /**
   * Job 취소
   */
  @Post('queues/:name/jobs/:jobId/cancel')
  async cancelJob(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancelJob(name, jobId, req.user.sub);
  }

  // ============================================
  // P2: Incidents API
  // ============================================

  /**
   * Incident 목록 조회
   */
  @Get('incidents')
  async getIncidents(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.incidentService.getIncidents({
      status: status as IncidentStatus | undefined,
      type: type as IncidentType | undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /**
   * Active Incidents 조회 (Overview Banner용)
   */
  @Get('incidents/active')
  async getActiveIncidents() {
    return this.incidentService.getActiveIncidents();
  }

  /**
   * Incident 상세 조회
   */
  @Get('incidents/:id')
  async getIncidentDetail(@Param('id') id: string) {
    return this.incidentService.getIncidentById(id);
  }

  /**
   * Incident 확인 (Acknowledge)
   */
  @Post('incidents/:id/acknowledge')
  async acknowledgeIncident(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.incidentService.acknowledgeIncident(id, req.user.sub);
  }

  /**
   * Incident 해결 (Resolve)
   */
  @Post('incidents/:id/resolve')
  async resolveIncident(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.incidentService.resolveIncident(id, req.user.sub, reason);
  }
}

