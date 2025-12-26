/**
 * Worker Heartbeat 서비스
 * Redis ZSET 기반 워커 상태 조회 (KEYS 명령어 사용 금지!)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  HEARTBEAT_REDIS_KEYS,
  WORKER_ONLINE_THRESHOLD_MS,
} from '@/common/constants';

/**
 * 워커 정보 인터페이스
 */
export interface WorkerInfo {
  workerId: string;
  hostname?: string;
  pid?: number;
  queueName?: string;
  status: 'ONLINE' | 'OFFLINE';
  activeJobs?: number;
  processedJobs?: number;
  failedJobs?: number;
  startedAt?: string;
  timestamp?: string;
}

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit {
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Redis 클라이언트 초기화
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    });

    this.logger.log('WorkerHeartbeatService 초기화 완료');
  }

  /**
   * 온라인 워커 목록 조회
   * - ZRANGEBYSCORE: O(log N + M) - 매우 효율적
   * - KEYS 명령어 사용 금지!
   */
  async getOnlineWorkers(): Promise<WorkerInfo[]> {
    const now = Date.now();
    const threshold = now - WORKER_ONLINE_THRESHOLD_MS;

    // 1. ZSET에서 online 워커 ID 조회 (30초 이내 heartbeat)
    const workerIds = await this.redis.zrangebyscore(
      HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY,
      threshold,
      '+inf'
    );

    if (workerIds.length === 0) {
      return [];
    }

    // 2. 워커 상세 정보 배치 조회 (MGET: O(N))
    const infoKeys = workerIds.map(
      (id: string) => `${HEARTBEAT_REDIS_KEYS.WORKER_INFO_PREFIX}${id}`
    );
    const infoValues = await this.redis.mget(infoKeys);

    // 3. 결과 조합
    return workerIds.map((id: string, i: number) => {
      const raw = infoValues[i];
      if (raw) {
        try {
          const info = JSON.parse(raw);
          return {
            workerId: id,
            status: 'ONLINE' as const,
            ...info,
          };
        } catch {
          // JSON 파싱 실패 시 기본 정보만 반환
        }
      }
      return {
        workerId: id,
        status: 'ONLINE' as const,
      };
    });
  }

  /**
   * 온라인 워커 수 조회
   * - ZCOUNT: O(log N) - 매우 빠름
   */
  async getOnlineWorkerCount(): Promise<number> {
    const threshold = Date.now() - WORKER_ONLINE_THRESHOLD_MS;

    return this.redis.zcount(
      HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY,
      threshold,
      '+inf'
    );
  }

  /**
   * 전체 워커 수 조회 (온라인 + 오프라인 포함)
   * - ZCARD: O(1)
   */
  async getTotalWorkerCount(): Promise<number> {
    return this.redis.zcard(HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY);
  }

  /**
   * 특정 워커 정보 조회
   */
  async getWorkerInfo(workerId: string): Promise<WorkerInfo | null> {
    const raw = await this.redis.get(
      `${HEARTBEAT_REDIS_KEYS.WORKER_INFO_PREFIX}${workerId}`
    );

    if (!raw) {
      return null;
    }

    try {
      const info = JSON.parse(raw);
      
      // 온라인 여부 확인
      const score = await this.redis.zscore(
        HEARTBEAT_REDIS_KEYS.HEARTBEAT_KEY,
        workerId
      );
      
      const threshold = Date.now() - WORKER_ONLINE_THRESHOLD_MS;
      const isOnline = score !== null && parseInt(score, 10) > threshold;

      return {
        workerId,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        ...info,
      };
    } catch {
      return null;
    }
  }

  /**
   * 모듈 종료 시 Redis 연결 정리
   */
  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

