/**
 * Worker Monitor 모듈
 * 큐/워커 모니터링 + StatsSnapshot Repeatable Job 등록
 */

import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { AuditLogModule } from '@/modules/audit-log/audit-log.module';
import { QUEUE_NAMES, SYSTEM_JOB_TYPES } from '@/common/constants';
import { WorkerMonitorController } from './worker-monitor.controller';
import { WorkerMonitorService } from './worker-monitor.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { IncidentService } from './incident.service';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    // BullMQ 큐 등록
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CAFE_JOBS },
      { name: QUEUE_NAMES.SYSTEM_JOBS },
    ),
  ],
  controllers: [WorkerMonitorController],
  providers: [WorkerMonitorService, WorkerHeartbeatService, IncidentService],
  exports: [WorkerMonitorService, WorkerHeartbeatService, IncidentService],
})
export class WorkerMonitorModule implements OnModuleInit {
  private readonly logger = new Logger(WorkerMonitorModule.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.SYSTEM_JOBS) private systemQueue: Queue,
  ) {}

  /**
   * 모듈 초기화 시 Repeatable Job 등록
   * - StatsSnapshot 수집: 1분마다 실행
   * - BullMQ Repeatable Job은 자동으로 단일 실행 보장 (분산락 내장)
   */
  async onModuleInit() {
    try {
      // 기존 repeatable job 정리 (설정 변경 시 필요)
      const existingJobs = await this.systemQueue.getRepeatableJobs();
      for (const job of existingJobs) {
        if (job.name === SYSTEM_JOB_TYPES.COLLECT_STATS_SNAPSHOT) {
          await this.systemQueue.removeRepeatableByKey(job.key);
          this.logger.debug(`기존 Repeatable Job 제거: ${job.key}`);
        }
      }

      // Repeatable Job 등록
      await this.systemQueue.add(
        SYSTEM_JOB_TYPES.COLLECT_STATS_SNAPSHOT,
        {}, // payload 없음
        {
          repeat: {
            every: 60_000, // 1분마다
          },
          jobId: 'stats-snapshot-collector', // 고정 ID로 중복 방지
          removeOnComplete: { count: 10 },   // 최근 10개 완료 Job만 유지
          removeOnFail: { count: 50 },       // 최근 50개 실패 Job 유지
        }
      );

      this.logger.log('✅ StatsSnapshot Repeatable Job 등록 완료 (1분 간격)');
    } catch (error) {
      this.logger.error(
        '❌ Repeatable Job 등록 실패:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

