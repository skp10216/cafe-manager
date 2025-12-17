/**
 * Job Producer
 * BullMQ 큐에 작업 추가
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JobType } from '@/common/constants';

@Injectable()
export class JobProducer {
  private readonly logger = new Logger(JobProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.CAFE_JOBS) private readonly cafeJobsQueue: Queue
  ) {}

  /**
   * 큐에 작업 추가
   */
  async addJob(
    jobId: string,
    type: JobType,
    payload: Record<string, unknown>
  ): Promise<void> {
    this.logger.log(
      `BullMQ 큐 추가 시도: jobId=${jobId}, type=${type}`
    );

    try {
      // 로그인/세션 계열 작업은 외부(네이버) 요인으로 실패할 가능성이 높고,
      // 같은 입력으로 재시도해도 성공 확률이 낮은 케이스(캡차/추가인증/보안경고)가 많다.
      // -> 과도한 재시도로 "무한 반복처럼 보이는" 현상을 줄이기 위해 attempts를 낮춘다.
      const attemptsByType: Record<string, number> = {
        INIT_SESSION: 1,
        VERIFY_SESSION: 1,
      };
      const attempts = attemptsByType[type] ?? 3;

      await this.cafeJobsQueue.add(
        type, // Job 이름 (타입)
        {
          jobId,
          type,
          payload,
        },
        {
          jobId, // BullMQ 내부 ID로 DB ID 사용
          attempts,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5초부터 시작하여 지수적으로 증가
          },
          removeOnComplete: {
            age: 24 * 3600, // 완료된 작업은 24시간 후 삭제
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // 실패한 작업은 7일 후 삭제
          },
        }
      );

      this.logger.log(
        `BullMQ 큐 추가 성공: jobId=${jobId}, type=${type}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `BullMQ 큐 추가 중 오류: jobId=${jobId}, type=${type}, error=${message}`,
        error instanceof Error ? error.stack : undefined
      );

      // 상위에서 처리할 수 있도록 예외를 그대로 전달
      throw error;
    }
  }
}

