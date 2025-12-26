/**
 * System Job Processor
 * Worker Monitor 시스템 작업 처리 (StatsSnapshot 수집 + Incident 감지)
 */

import { Job, Queue } from 'bullmq';
import { PrismaClient, IncidentType, IncidentSeverity, IncidentStatus } from '@prisma/client';
import Redis from 'ioredis';
import { QUEUE_NAMES, SYSTEM_JOB_TYPES } from '../constants';
import { createLogger } from '../utils/logger';
import { HEARTBEAT_REDIS_KEYS } from '../heartbeat';

const logger = createLogger('SystemJob');

// 워커 온라인 판정 기준 (30초 이내 heartbeat)
const ONLINE_THRESHOLD_MS = 30_000;

// 스냅샷 보관 기간 (24시간)
const SNAPSHOT_RETENTION_MS = 24 * 60 * 60 * 1000;

// Incident 감지 임계값
const THRESHOLDS = {
  QUEUE_BACKLOG: {
    WARNING: 100,    // 100개 이상 대기 → MEDIUM
    CRITICAL: 500,   // 500개 이상 대기 → HIGH
  },
  HIGH_FAILURE_RATE: {
    WARNING: 10,     // 10% 이상 실패율 → MEDIUM
    CRITICAL: 30,    // 30% 이상 실패율 → HIGH
  },
};

export class SystemJobProcessor {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  /**
   * System Job 처리 분기
   */
  async process(job: Job): Promise<void> {
    switch (job.name) {
      case SYSTEM_JOB_TYPES.COLLECT_STATS_SNAPSHOT:
        await this.collectStatsSnapshot();
        break;

      default:
        throw new Error(`Unknown system job type: ${job.name}`);
    }
  }

  /**
   * 큐 통계 스냅샷 수집
   * - 1분마다 Repeatable Job으로 실행
   * - BullMQ 상태 + Redis 워커 수 → DB 저장
   */
  private async collectStatsSnapshot(): Promise<void> {
    const startTime = Date.now();
    logger.info('📊 큐 통계 스냅샷 수집 시작');

    const queueName = QUEUE_NAMES.CAFE_JOBS;

    // BullMQ Queue 인스턴스 생성 (조회용)
    const queue = new Queue(queueName, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    });

    try {
      // 1. BullMQ에서 현재 상태 조회
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed'
      );
      const isPaused = await queue.isPaused();

      // 2. Redis ZSET에서 온라인 워커 수 조회 (ZCOUNT: O(log N))
      const threshold = Date.now() - ONLINE_THRESHOLD_MS;
      const onlineWorkers = await this.redis.zcount(
        HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY,
        threshold,
        '+inf'
      );

      // 3. 직전 스냅샷 조회 (처리량 계산용)
      const prevSnapshot = await this.prisma.queueStatsSnapshot.findFirst({
        where: { queueName },
        orderBy: { timestamp: 'desc' },
      });

      // 4. jobsPerMin 계산 (음수 방어: clean/리셋 시 completed가 줄어들 수 있음)
      let jobsPerMin: number | null = null;
      if (prevSnapshot) {
        const diff = counts.completed - prevSnapshot.completed;
        jobsPerMin = Math.max(0, diff);  // 음수면 0으로 (큐 clean 등)
      }

      // 5. 스냅샷 저장
      await this.prisma.queueStatsSnapshot.create({
        data: {
          queueName,
          waiting: counts.waiting,
          active: counts.active,
          delayed: counts.delayed,
          completed: counts.completed,
          failed: counts.failed,
          paused: isPaused,
          jobsPerMin,
          onlineWorkers,
        },
      });

      // 6. Incident 감지
      await this.detectIncidents(queueName, {
        waiting: counts.waiting,
        failed: counts.failed,
        completed: counts.completed,
        jobsPerMin,
      });

      // 7. 오프라인 워커 정리
      const offlineIds = await this.cleanupOfflineWorkers();
      if (offlineIds.length > 0) {
        logger.info(`오프라인 워커 정리: ${offlineIds.length}개`);
      }

      // 8. 오래된 스냅샷 정리 (24시간 이상)
      await this.cleanupOldSnapshots();

      const elapsed = Date.now() - startTime;
      logger.info(`✅ 스냅샷 수집 완료 (${elapsed}ms)`, {
        waiting: counts.waiting,
        active: counts.active,
        delayed: counts.delayed,
        failed: counts.failed,
        onlineWorkers,
        jobsPerMin,
        paused: isPaused,
      });
    } finally {
      // Queue 인스턴스 정리
      await queue.close();
    }
  }

  /**
   * 오프라인 워커 정리 (ZSET에서 오래된 항목 제거)
   * ZREMRANGEBYSCORE: O(log N + M)
   */
  private async cleanupOfflineWorkers(): Promise<string[]> {
    const threshold = Date.now() - ONLINE_THRESHOLD_MS;

    // 삭제 전 오프라인 워커 ID 조회 (로깅용)
    const offlineIds = await this.redis.zrangebyscore(
      HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY,
      '-inf',
      threshold
    );

    if (offlineIds.length > 0) {
      // ZSET에서 오래된 항목 제거
      await this.redis.zremrangebyscore(
        HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY,
        '-inf',
        threshold
      );

      // 상세 정보 키도 삭제 시도 (이미 TTL로 만료되었을 수 있음)
      for (const workerId of offlineIds) {
        await this.redis.del(`${HEARTBEAT_REDIS_KEYS.WORKER_INFO_PREFIX}${workerId}`).catch(() => {});
      }
    }

    return offlineIds;
  }

  /**
   * 오래된 스냅샷 정리 (24시간 이상)
   */
  private async cleanupOldSnapshots(): Promise<void> {
    const cutoff = new Date(Date.now() - SNAPSHOT_RETENTION_MS);

    const result = await this.prisma.queueStatsSnapshot.deleteMany({
      where: { timestamp: { lt: cutoff } },
    });

    if (result.count > 0) {
      logger.debug(`오래된 스냅샷 ${result.count}개 삭제`);
    }
  }

  // ============================================
  // Incident Detection
  // ============================================

  /**
   * 이상 징후 감지
   */
  private async detectIncidents(queueName: string, stats: {
    waiting: number;
    failed: number;
    completed: number;
    jobsPerMin: number | null;
  }): Promise<void> {
    await this.detectQueueBacklog(queueName, stats.waiting);
    await this.detectHighFailureRate(queueName, stats.failed, stats.completed);
  }

  /**
   * 대기열 적체 감지
   */
  private async detectQueueBacklog(queueName: string, waiting: number): Promise<void> {
    const type = IncidentType.QUEUE_BACKLOG;

    // 현재 활성 Incident 확인
    const existingIncident = await this.prisma.incident.findFirst({
      where: {
        type,
        queueName,
        status: { in: [IncidentStatus.ACTIVE, IncidentStatus.ACKNOWLEDGED] },
      },
    });

    // 임계값 판정
    let severity: IncidentSeverity | null = null;
    if (waiting >= THRESHOLDS.QUEUE_BACKLOG.CRITICAL) {
      severity = IncidentSeverity.HIGH;
    } else if (waiting >= THRESHOLDS.QUEUE_BACKLOG.WARNING) {
      severity = IncidentSeverity.MEDIUM;
    }

    if (severity) {
      if (!existingIncident) {
        await this.createIncident({
          type,
          severity,
          queueName,
          affectedJobs: waiting,
          title: `대기열 적체: ${queueName}`,
          description: `${waiting}개의 작업이 대기 중입니다.`,
          recommendedAction: '워커 수를 늘리거나, 스케줄 포스팅을 일시 중지하세요.',
        });
      } else if (existingIncident.severity !== severity) {
        await this.prisma.incident.update({
          where: { id: existingIncident.id },
          data: { severity, affectedJobs: waiting },
        });
        logger.warn(`⚠️ Incident 심각도 변경: ${existingIncident.id} → ${severity}`);
      }
    } else if (existingIncident && waiting < THRESHOLDS.QUEUE_BACKLOG.WARNING / 2) {
      await this.autoResolveIncident(existingIncident.id, '대기열이 정상 수준으로 돌아왔습니다.');
    }
  }

  /**
   * 높은 실패율 감지
   */
  private async detectHighFailureRate(
    queueName: string,
    failed: number,
    completed: number
  ): Promise<void> {
    const type = IncidentType.HIGH_FAILURE_RATE;

    // 1시간 전 스냅샷 조회
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldSnapshot = await this.prisma.queueStatsSnapshot.findFirst({
      where: {
        queueName,
        timestamp: { lte: oneHourAgo },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!oldSnapshot) return;

    const recentFailed = Math.max(0, failed - oldSnapshot.failed);
    const recentCompleted = Math.max(0, completed - oldSnapshot.completed);
    const total = recentFailed + recentCompleted;

    if (total < 10) return; // 샘플 부족

    const failureRate = (recentFailed / total) * 100;

    // 현재 활성 Incident 확인
    const existingIncident = await this.prisma.incident.findFirst({
      where: {
        type,
        queueName,
        status: { in: [IncidentStatus.ACTIVE, IncidentStatus.ACKNOWLEDGED] },
      },
    });

    // 임계값 판정
    let severity: IncidentSeverity | null = null;
    if (failureRate >= THRESHOLDS.HIGH_FAILURE_RATE.CRITICAL) {
      severity = IncidentSeverity.HIGH;
    } else if (failureRate >= THRESHOLDS.HIGH_FAILURE_RATE.WARNING) {
      severity = IncidentSeverity.MEDIUM;
    }

    if (severity) {
      if (!existingIncident) {
        await this.createIncident({
          type,
          severity,
          queueName,
          affectedJobs: recentFailed,
          title: `높은 실패율: ${queueName}`,
          description: `최근 1시간 실패율이 ${failureRate.toFixed(1)}%입니다. (${recentFailed}/${total})`,
          recommendedAction: '실패 로그를 확인하고, 문제 원인을 파악하세요.',
        });
      } else if (existingIncident.severity !== severity) {
        await this.prisma.incident.update({
          where: { id: existingIncident.id },
          data: {
            severity,
            affectedJobs: recentFailed,
            description: `최근 1시간 실패율이 ${failureRate.toFixed(1)}%입니다. (${recentFailed}/${total})`,
          },
        });
      }
    } else if (existingIncident && failureRate < THRESHOLDS.HIGH_FAILURE_RATE.WARNING / 2) {
      await this.autoResolveIncident(existingIncident.id, '실패율이 정상 수준으로 돌아왔습니다.');
    }
  }

  /**
   * Incident 생성
   */
  private async createIncident(data: {
    type: IncidentType;
    severity: IncidentSeverity;
    queueName: string;
    affectedJobs: number;
    title: string;
    description: string;
    recommendedAction: string;
  }): Promise<void> {
    try {
      await this.prisma.incident.create({
        data: {
          ...data,
          status: IncidentStatus.ACTIVE,
        },
      });
      logger.warn(`🚨 Incident 생성: [${data.severity}] ${data.title}`);
    } catch (error: any) {
      // unique constraint 충돌 시 무시
      if (error?.code === 'P2002') {
        logger.debug('중복 Incident 생성 시도 무시');
      } else {
        throw error;
      }
    }
  }

  /**
   * Incident 자동 해결
   */
  private async autoResolveIncident(id: string, reason: string): Promise<void> {
    await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: 'SYSTEM',
      },
    });
    logger.log(`✅ Incident 자동 해결: ${id} - ${reason}`);
  }
}

