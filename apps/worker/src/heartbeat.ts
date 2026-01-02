/**
 * Worker Heartbeat 모듈
 * Redis ZSET 기반 워커 상태 관리 (KEYS 명령어 사용 금지!)
 */

import Redis from 'ioredis';
import { hostname } from 'os';
import { createLogger } from './utils/logger';

const logger = createLogger('Heartbeat');

// Redis 키 정의
const HEARTBEAT_KEY = 'cafe-manager:workers:heartbeat';  // ZSET
const WORKER_INFO_PREFIX = 'cafe-manager:workers:info:';  // STRING + TTL

// 설정값
const HEARTBEAT_INTERVAL_MS = 10_000;  // 10초마다 heartbeat 전송
const WORKER_INFO_TTL_SEC = 60;        // 워커 정보 TTL 60초

/**
 * 워커 통계 인터페이스
 */
export interface WorkerStats {
  activeJobs: number;
  processedJobs: number;
  failedJobs: number;
}

/**
 * Worker Heartbeat 설정 및 시작
 * 
 * @param redis Redis 클라이언트
 * @param queueName 담당 큐 이름
 * @param getStats 현재 워커 통계를 반환하는 함수
 * @returns cleanup 함수 (종료 시 호출)
 */
export function setupHeartbeat(
  redis: Redis,
  queueName: string,
  getStats: () => WorkerStats
): () => Promise<void> {
  const workerId = `worker-${hostname()}-${process.pid}`;
  const startedAt = new Date().toISOString();

  logger.info(`💓 Heartbeat 시작: ${workerId}`);

  /**
   * Heartbeat 전송
   * - ZSET에 timestamp를 score로 저장 (O(log N))
   * - 별도 STRING 키에 상세 정보 저장 (TTL 60초)
   */
  const sendHeartbeat = async () => {
    try {
      const now = Date.now();
      const stats = getStats();

      // 1. ZSET에 timestamp(score)로 워커 등록/갱신
      //    ZADD: O(log N) - 매우 효율적
      await redis.zadd(HEARTBEAT_KEY, now, workerId);

      // 2. 워커 상세 정보는 별도 키에 저장 (TTL 적용)
      //    SETEX: O(1)
      const workerInfo = JSON.stringify({
        workerId,
        hostname: hostname(),
        pid: process.pid,
        queueName,
        activeJobs: stats.activeJobs,
        processedJobs: stats.processedJobs,
        failedJobs: stats.failedJobs,
        startedAt,
        timestamp: new Date().toISOString(),
      });

      await redis.setex(
        `${WORKER_INFO_PREFIX}${workerId}`,
        WORKER_INFO_TTL_SEC,
        workerInfo
      );

      logger.debug(`Heartbeat 전송 완료: active=${stats.activeJobs}, processed=${stats.processedJobs}`);
    } catch (error) {
      // Heartbeat 실패는 치명적이지 않으므로 경고만 로깅
      logger.warn('Heartbeat 전송 실패:', error instanceof Error ? error.message : error);
    }
  };

  // 즉시 1회 전송 + 주기적 반복
  sendHeartbeat();
  const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  /**
   * Cleanup 함수 - Worker 종료 시 호출
   * ZSET에서 제거하여 즉시 OFFLINE 처리
   */
  return async () => {
    clearInterval(intervalId);

    try {
      // ZSET에서 워커 제거
      await redis.zrem(HEARTBEAT_KEY, workerId);
      // 상세 정보 키 삭제
      await redis.del(`${WORKER_INFO_PREFIX}${workerId}`);

      logger.info(`💔 Heartbeat 종료: ${workerId}`);
    } catch (error) {
      logger.warn('Heartbeat cleanup 실패:', error instanceof Error ? error.message : error);
    }
  };
}

/**
 * Redis 키 상수 내보내기 (API에서도 사용)
 */
export const HEARTBEAT_REDIS_KEYS = {
  HEARTBEAT_KEY,
  WORKER_INFO_PREFIX,
} as const;



