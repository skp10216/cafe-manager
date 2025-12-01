/**
 * Job Producer
 * BullMQ 큐에 작업 추가
 */

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JobType } from '@/common/constants';

@Injectable()
export class JobProducer {
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
    await this.cafeJobsQueue.add(
      type, // Job 이름 (타입)
      {
        jobId,
        type,
        payload,
      },
      {
        jobId, // BullMQ 내부 ID로 DB ID 사용
        attempts: 3,
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
  }
}

