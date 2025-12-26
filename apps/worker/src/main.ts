/**
 * 카페매니저 Worker 진입점
 * BullMQ Worker를 시작하여 Job 처리
 * - cafe-jobs: 네이버 카페 작업 (게시글 작성, 세션 관리 등)
 * - system-jobs: Worker Monitor 시스템 작업 (StatsSnapshot 수집)
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { QUEUE_NAMES } from './constants';
import { createLogger } from './utils/logger';
import { JobProcessor } from './jobs/job-processor';
import { SystemJobProcessor } from './jobs/system-job-processor';
import { BrowserManager } from './playwright/browser-manager';
import { setupHeartbeat, WorkerStats } from './heartbeat';

const logger = createLogger('Worker');

// Prisma 클라이언트
const prisma = new PrismaClient();

// 브라우저 매니저
const browserManager = new BrowserManager();

// Job 프로세서
const jobProcessor = new JobProcessor(prisma, browserManager);

async function main() {
  logger.info('🚀 카페매니저 Worker 시작...');

  // Redis 연결 설정
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  // BullMQ용 connection 객체
  const connection = redisConfig;

  // Heartbeat용 별도 Redis 클라이언트 (ioredis)
  const redis = new Redis(redisConfig);

  // ============================================
  // 워커 통계 추적 (Heartbeat용)
  // ============================================
  let processedCount = 0;
  let failedCount = 0;
  let activeJobs = 0;

  const getStats = (): WorkerStats => ({
    activeJobs,
    processedJobs: processedCount,
    failedJobs: failedCount,
  });

  // ============================================
  // 1. Heartbeat 시작 (Redis ZSET 기반)
  // ============================================
  const cleanupHeartbeat = setupHeartbeat(redis, QUEUE_NAMES.CAFE_JOBS, getStats);

  // ============================================
  // 2. 메인 Job Worker (cafe-jobs)
  // ============================================
  const cafeWorker = new Worker(
    QUEUE_NAMES.CAFE_JOBS,
    async (job) => {
      logger.info(`📥 Job 수신: ${job.name} (${job.id})`);
      activeJobs++;

      try {
        await jobProcessor.process(job);
        processedCount++;
        logger.info(`✅ Job 완료: ${job.name} (${job.id})`);
      } catch (error) {
        failedCount++;
        logger.error(`❌ Job 실패: ${job.name} (${job.id})`, error);
        throw error;
      } finally {
        activeJobs--;
      }
    },
    {
      connection,
      concurrency: 1, // 동시 처리 수 (네이버 계정당 1개씩 처리)
      limiter: {
        max: 10, // 분당 최대 10개 Job
        duration: 60000,
      },
    }
  );

  // cafe-jobs Worker 이벤트 핸들러
  cafeWorker.on('completed', (job) => {
    logger.debug(`CafeJob ${job.id} 완료`);
  });

  cafeWorker.on('failed', (job, err) => {
    logger.error(`CafeJob ${job?.id} 실패:`, err.message);
  });

  cafeWorker.on('error', (err) => {
    logger.error('CafeWorker 오류:', err);
  });

  // ============================================
  // 3. 시스템 Job Worker (system-jobs)
  // ============================================
  const systemJobProcessor = new SystemJobProcessor(prisma, redis);
  
  const systemWorker = new Worker(
    QUEUE_NAMES.SYSTEM_JOBS,
    async (job) => {
      logger.info(`📥 System Job 수신: ${job.name}`);
      
      try {
        await systemJobProcessor.process(job);
        logger.info(`✅ System Job 완료: ${job.name}`);
      } catch (error) {
        logger.error(`❌ System Job 실패: ${job.name}`, error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,  // 시스템 작업은 순차 처리
    }
  );

  // system-jobs Worker 이벤트 핸들러
  systemWorker.on('completed', (job) => {
    logger.debug(`SystemJob ${job.name} 완료`);
  });

  systemWorker.on('failed', (job, err) => {
    logger.error(`SystemJob ${job?.name} 실패:`, err.message);
  });

  systemWorker.on('error', (err) => {
    logger.error('SystemWorker 오류:', err);
  });

  // ============================================
  // 종료 시그널 처리
  // ============================================
  const shutdown = async () => {
    logger.info('Worker 종료 중...');

    // 1. Heartbeat 정리 (즉시 OFFLINE 처리)
    await cleanupHeartbeat();

    // 2. Workers 종료
    await cafeWorker.close();
    await systemWorker.close();

    // 3. 브라우저 정리
    await browserManager.closeAll();

    // 4. DB/Redis 연결 정리
    await prisma.$disconnect();
    await redis.quit();

    logger.info('✅ Worker 정상 종료');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('✅ Worker가 Job 대기 중입니다');
  logger.info(`   - cafe-jobs: 네이버 카페 작업`);
  logger.info(`   - system-jobs: 시스템 모니터링 작업`);
}

main().catch((error) => {
  logger.error('Worker 시작 실패:', error);
  process.exit(1);
});
