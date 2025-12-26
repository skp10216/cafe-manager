/**
 * Worker Monitor 서비스
 * 큐 상태 조회, 트렌드 분석, Queue/Job Actions
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobState } from 'bullmq';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { QUEUE_NAMES } from '@/common/constants';
import { AuditAction, EntityType } from '@prisma/client';

@Injectable()
export class WorkerMonitorService {
  private readonly logger = new Logger(WorkerMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly heartbeatService: WorkerHeartbeatService,
    private readonly auditLogService: AuditLogService,
    @InjectQueue(QUEUE_NAMES.CAFE_JOBS) private readonly cafeQueue: Queue,
  ) {}

  /**
   * Overview - KPI 통계
   * 대시보드 상단 KPI 카드용 데이터
   */
  async getOverview() {
    const [counts, isPaused, onlineWorkers, latestSnapshot, stats24h] =
      await Promise.all([
        // 현재 큐 상태
        this.cafeQueue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'completed',
          'failed'
        ),
        this.cafeQueue.isPaused(),
        // 온라인 워커 수
        this.heartbeatService.getOnlineWorkerCount(),
        // 최신 스냅샷
        this.prisma.queueStatsSnapshot.findFirst({
          where: { queueName: QUEUE_NAMES.CAFE_JOBS },
          orderBy: { timestamp: 'desc' },
        }),
        // 24시간 통계
        this.get24hStats(),
      ]);

    // Active Incidents (P2에서 활성화)
    const activeIncidents: unknown[] = [];
    // const activeIncidents = await this.prisma.incident.findMany({
    //   where: { status: 'ACTIVE' },
    //   orderBy: { startedAt: 'desc' },
    // });

    return {
      // 큐 상태
      queues: {
        [QUEUE_NAMES.CAFE_JOBS]: {
          name: QUEUE_NAMES.CAFE_JOBS,
          displayName: '카페 작업 큐',
          ...counts,
          paused: isPaused,
        },
      },
      // 워커 상태
      workers: {
        online: onlineWorkers,
        total: onlineWorkers, // P0에서는 online = total
      },
      // 성능 지표
      performance: {
        jobsPerMin: latestSnapshot?.jobsPerMin ?? 0,
        successRate24h: stats24h.successRate,
        failed24h: stats24h.failed,
        completed24h: stats24h.completed,
      },
      // 이상 징후 (P2에서 활성화)
      incidents: activeIncidents,
      // 타임스탬프
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 큐 목록 + 현재 상태
   */
  async getQueues() {
    const queueName = QUEUE_NAMES.CAFE_JOBS;

    const [counts, isPaused, latestSnapshot] = await Promise.all([
      this.cafeQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed'
      ),
      this.cafeQueue.isPaused(),
      this.prisma.queueStatsSnapshot.findFirst({
        where: { queueName },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // 상태 판정
    let status: 'RUNNING' | 'PAUSED' | 'DEGRADED' = 'RUNNING';
    if (isPaused) {
      status = 'PAUSED';
    } else if (counts.waiting > 200) {
      status = 'DEGRADED';
    }

    return [
      {
        name: queueName,
        displayName: '카페 작업 큐',
        status,
        counts: {
          waiting: counts.waiting,
          active: counts.active,
          delayed: counts.delayed,
          completed: counts.completed,
          failed: counts.failed,
        },
        jobsPerMin: latestSnapshot?.jobsPerMin ?? 0,
        onlineWorkers: latestSnapshot?.onlineWorkers ?? 0,
        lastUpdated: latestSnapshot?.timestamp ?? null,
      },
    ];
  }

  /**
   * 큐 상세 정보
   */
  async getQueueDetail(queueName: string) {
    // 현재는 단일 큐만 지원
    if (queueName !== QUEUE_NAMES.CAFE_JOBS) {
      return null;
    }

    const [counts, isPaused, latestSnapshot, recentSnapshots] =
      await Promise.all([
        this.cafeQueue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'completed',
          'failed'
        ),
        this.cafeQueue.isPaused(),
        this.prisma.queueStatsSnapshot.findFirst({
          where: { queueName },
          orderBy: { timestamp: 'desc' },
        }),
        // 최근 10개 스냅샷 (간단한 트렌드용)
        this.prisma.queueStatsSnapshot.findMany({
          where: { queueName },
          orderBy: { timestamp: 'desc' },
          take: 10,
        }),
      ]);

    return {
      name: queueName,
      displayName: '카페 작업 큐',
      status: isPaused ? 'PAUSED' : counts.waiting > 200 ? 'DEGRADED' : 'RUNNING',
      counts,
      paused: isPaused,
      jobsPerMin: latestSnapshot?.jobsPerMin ?? 0,
      onlineWorkers: latestSnapshot?.onlineWorkers ?? 0,
      lastUpdated: latestSnapshot?.timestamp ?? null,
      recentTrend: recentSnapshots.reverse(),
    };
  }

  /**
   * 큐 트렌드 (시계열 데이터)
   * @param queueName 큐 이름
   * @param hours 조회 기간 (시간)
   */
  async getQueueTrend(queueName: string, hours = 1) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshots = await this.prisma.queueStatsSnapshot.findMany({
      where: {
        queueName,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        waiting: true,
        active: true,
        delayed: true,
        failed: true,
        completed: true,
        jobsPerMin: true,
        onlineWorkers: true,
        paused: true,
      },
    });

    return {
      queueName,
      period: `${hours}h`,
      dataPoints: snapshots.length,
      data: snapshots,
    };
  }

  /**
   * 24시간 통계 (성공률 계산용)
   */
  private async get24hStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 24시간 전 스냅샷
    const oldSnapshot = await this.prisma.queueStatsSnapshot.findFirst({
      where: {
        queueName: QUEUE_NAMES.CAFE_JOBS,
        timestamp: { lte: since },
      },
      orderBy: { timestamp: 'desc' },
    });

    // 최신 스냅샷
    const latestSnapshot = await this.prisma.queueStatsSnapshot.findFirst({
      where: { queueName: QUEUE_NAMES.CAFE_JOBS },
      orderBy: { timestamp: 'desc' },
    });

    if (!oldSnapshot || !latestSnapshot) {
      return { successRate: 100, completed: 0, failed: 0 };
    }

    // 음수 방어 (큐 clean 등으로 값이 줄어들 수 있음)
    const completed = Math.max(
      0,
      latestSnapshot.completed - oldSnapshot.completed
    );
    const failed = Math.max(0, latestSnapshot.failed - oldSnapshot.failed);
    const total = completed + failed;

    const successRate = total > 0 ? Math.round((completed / total) * 100) : 100;

    return { successRate, completed, failed };
  }

  // ============================================
  // P1: Queue Actions
  // ============================================

  /**
   * 큐 일시정지
   */
  async pauseQueue(queueName: string, adminId: string, reason?: string) {
    const queue = this.getQueue(queueName);
    
    const wasPaused = await queue.isPaused();
    if (wasPaused) {
      throw new BadRequestException('큐가 이미 일시정지 상태입니다.');
    }

    await queue.pause();

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.QUEUE,
      entityId: queueName,
      action: AuditAction.QUEUE_PAUSE,
      reason,
      newValue: { paused: true },
    });

    this.logger.log(`큐 일시정지: ${queueName} by ${adminId}`);
    return { success: true, message: '큐가 일시정지되었습니다.' };
  }

  /**
   * 큐 재개
   */
  async resumeQueue(queueName: string, adminId: string, reason?: string) {
    const queue = this.getQueue(queueName);
    
    const wasPaused = await queue.isPaused();
    if (!wasPaused) {
      throw new BadRequestException('큐가 이미 실행 중입니다.');
    }

    await queue.resume();

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.QUEUE,
      entityId: queueName,
      action: AuditAction.QUEUE_RESUME,
      reason,
      newValue: { paused: false },
    });

    this.logger.log(`큐 재개: ${queueName} by ${adminId}`);
    return { success: true, message: '큐가 재개되었습니다.' };
  }

  /**
   * 실패한 작업 일괄 재시도
   */
  async retryFailedJobs(queueName: string, adminId: string, limit = 100) {
    const queue = this.getQueue(queueName);
    
    const failedJobs = await queue.getFailed(0, limit - 1);
    if (failedJobs.length === 0) {
      return { success: true, retriedCount: 0, message: '재시도할 실패 작업이 없습니다.' };
    }

    let retriedCount = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (err) {
        this.logger.warn(`Job ${job.id} 재시도 실패:`, err);
      }
    }

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.QUEUE,
      entityId: queueName,
      action: AuditAction.QUEUE_RETRY_FAILED,
      metadata: { retriedCount, requestedLimit: limit },
    });

    this.logger.log(`실패 작업 재시도: ${queueName}, ${retriedCount}개 by ${adminId}`);
    return { success: true, retriedCount, message: `${retriedCount}개 작업이 재시도되었습니다.` };
  }

  /**
   * 대기 중인 작업 전체 제거 (Drain)
   */
  async drainQueue(queueName: string, adminId: string, delayed = true) {
    const queue = this.getQueue(queueName);
    
    const countsBefore = await queue.getJobCounts('waiting', 'delayed');
    const totalBefore = countsBefore.waiting + (delayed ? countsBefore.delayed : 0);

    await queue.drain(delayed);

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.QUEUE,
      entityId: queueName,
      action: AuditAction.QUEUE_DRAIN,
      metadata: { drainedCount: totalBefore, includeDelayed: delayed },
    });

    this.logger.warn(`큐 Drain: ${queueName}, ${totalBefore}개 제거 by ${adminId}`);
    return { success: true, drainedCount: totalBefore, message: `${totalBefore}개 대기 작업이 제거되었습니다.` };
  }

  /**
   * 완료/실패 작업 정리 (Clean)
   */
  async cleanQueue(
    queueName: string,
    adminId: string,
    status: 'completed' | 'failed' = 'completed',
    grace = 0,  // ms, 최근 N ms 내의 작업은 유지
    limit = 1000
  ) {
    const queue = this.getQueue(queueName);
    
    const removed = await queue.clean(grace, limit, status);

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.QUEUE,
      entityId: queueName,
      action: AuditAction.QUEUE_CLEAN,
      metadata: { cleanedCount: removed.length, status, grace, limit },
    });

    this.logger.log(`큐 Clean: ${queueName}, ${status} ${removed.length}개 정리 by ${adminId}`);
    return { success: true, cleanedCount: removed.length, message: `${removed.length}개 ${status} 작업이 정리되었습니다.` };
  }

  // ============================================
  // P1: Jobs API
  // ============================================

  /**
   * Job 목록 조회
   */
  async getJobs(
    queueName: string,
    options: {
      status?: JobState | 'all';
      start?: number;
      end?: number;
      asc?: boolean;
    } = {}
  ) {
    const queue = this.getQueue(queueName);
    const { status = 'all', start = 0, end = 49, asc = false } = options;

    let jobs: Job[];
    
    if (status === 'all') {
      // 모든 상태의 작업 조회
      const [waiting, active, delayed, completed, failed] = await Promise.all([
        queue.getWaiting(start, end),
        queue.getActive(start, end),
        queue.getDelayed(start, end),
        queue.getCompleted(start, end),
        queue.getFailed(start, end),
      ]);
      jobs = [...waiting, ...active, ...delayed, ...completed, ...failed];
    } else {
      // 특정 상태의 작업만 조회
      jobs = await queue.getJobs([status], start, end, asc);
    }

    // Job 데이터 변환
    return jobs.map((job) => this.formatJob(job));
  }

  /**
   * Job 상세 조회
   */
  async getJobDetail(queueName: string, jobId: string) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job을 찾을 수 없습니다: ${jobId}`);
    }

    const state = await job.getState();
    const logs = await queue.getJobLogs(jobId);

    return {
      ...this.formatJob(job),
      state,
      logs: logs.logs,
      logsCount: logs.count,
    };
  }

  /**
   * Job 재시도
   */
  async retryJob(queueName: string, jobId: string, adminId: string) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job을 찾을 수 없습니다: ${jobId}`);
    }

    const state = await job.getState();
    if (state !== 'failed') {
      throw new BadRequestException('실패한 작업만 재시도할 수 있습니다.');
    }

    await job.retry();

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.JOB,
      entityId: jobId,
      action: AuditAction.JOB_RETRY,
      metadata: { queueName, jobName: job.name },
    });

    this.logger.log(`Job 재시도: ${queueName}/${jobId} by ${adminId}`);
    return { success: true, message: 'Job이 재시도되었습니다.' };
  }

  /**
   * Job 취소 (대기/지연 중인 작업만)
   */
  async cancelJob(queueName: string, jobId: string, adminId: string) {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job을 찾을 수 없습니다: ${jobId}`);
    }

    const state = await job.getState();
    if (state !== 'waiting' && state !== 'delayed') {
      throw new BadRequestException('대기 또는 지연 상태의 작업만 취소할 수 있습니다.');
    }

    await job.remove();

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.JOB,
      entityId: jobId,
      action: AuditAction.JOB_CANCEL,
      metadata: { queueName, jobName: job.name, previousState: state },
    });

    this.logger.log(`Job 취소: ${queueName}/${jobId} by ${adminId}`);
    return { success: true, message: 'Job이 취소되었습니다.' };
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * 큐 인스턴스 가져오기
   */
  private getQueue(queueName: string): Queue {
    if (queueName !== QUEUE_NAMES.CAFE_JOBS) {
      throw new NotFoundException(`큐를 찾을 수 없습니다: ${queueName}`);
    }
    return this.cafeQueue;
  }

  /**
   * Job 데이터 포맷팅
   */
  private formatJob(job: Job) {
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: {
        attempts: job.opts?.attempts,
        delay: job.opts?.delay,
        priority: job.opts?.priority,
      },
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }
}

