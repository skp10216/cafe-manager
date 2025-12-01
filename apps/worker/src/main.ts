/**
 * 카페매니저 Worker 진입점
 * BullMQ Worker를 시작하여 Job 처리
 */

import 'dotenv/config';
import { Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { QUEUE_NAMES } from './constants';
import { createLogger } from './utils/logger';
import { JobProcessor } from './jobs/job-processor';
import { BrowserManager } from './playwright/browser-manager';

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
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  // Worker 생성
  const worker = new Worker(
    QUEUE_NAMES.CAFE_JOBS,
    async (job) => {
      logger.info(`📥 Job 수신: ${job.name} (${job.id})`);
      
      try {
        await jobProcessor.process(job);
        logger.info(`✅ Job 완료: ${job.name} (${job.id})`);
      } catch (error) {
        logger.error(`❌ Job 실패: ${job.name} (${job.id})`, error);
        throw error;
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

  // Worker 이벤트 핸들러
  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} 완료`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} 실패:`, err.message);
  });

  worker.on('error', (err) => {
    logger.error('Worker 오류:', err);
  });

  // 종료 시그널 처리
  const shutdown = async () => {
    logger.info('Worker 종료 중...');
    await worker.close();
    await browserManager.closeAll();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('✅ Worker가 Job 대기 중입니다');
}

main().catch((error) => {
  logger.error('Worker 시작 실패:', error);
  process.exit(1);
});

