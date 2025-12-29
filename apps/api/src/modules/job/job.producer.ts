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
   * 
   * @param dbJobId - DB Job ID (Worker가 DB 조회에 사용)
   * @param type - Job 타입
   * @param payload - Job payload
   * @param delay - 지연 시간 (ms)
   * @param bullmqJobId - BullMQ 내부 ID (중복 방지용, 없으면 dbJobId 사용)
   */
  async addJob(
    dbJobId: string,
    type: JobType,
    payload: Record<string, unknown>,
    delay?: number,
    bullmqJobId?: string  // 결정적 ID (중복 방지용)
  ): Promise<void> {
    const effectiveBullmqId = bullmqJobId || dbJobId;
    
    this.logger.log(
      `BullMQ 큐 추가 시도: dbJobId=${dbJobId}, bullmqId=${effectiveBullmqId}, type=${type}${delay ? `, delay=${delay}ms` : ''}`
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
          jobId: dbJobId,  // Worker가 DB 조회에 사용하는 실제 DB ID
          type,
          payload,
        },
        {
          jobId: effectiveBullmqId, // BullMQ 중복 방지용 ID
          attempts,
          delay,  // 지연 시간 옵션 추가
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
        `BullMQ 큐 추가 성공: dbJobId=${dbJobId}, bullmqId=${effectiveBullmqId}, type=${type}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `BullMQ 큐 추가 중 오류: dbJobId=${dbJobId}, type=${type}, error=${message}`,
        error instanceof Error ? error.stack : undefined
      );

      // 상위에서 처리할 수 있도록 예외를 그대로 전달
      throw error;
    }
  }

  /**
   * 큐에서 작업 제거 (취소 시 사용)
   * @param jobId 제거할 Job ID
   * @returns 제거 성공 여부
   */
  async removeJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.cafeJobsQueue.getJob(jobId);
      
      if (!job) {
        this.logger.debug(`BullMQ Job 없음: jobId=${jobId}`);
        return false;
      }

      // 대기 중이거나 지연된 작업만 제거 가능
      const state = await job.getState();
      if (state === 'waiting' || state === 'delayed') {
        await job.remove();
        this.logger.log(`BullMQ Job 제거 성공: jobId=${jobId}, state=${state}`);
        return true;
      }

      this.logger.debug(`BullMQ Job 제거 불가 (실행 중): jobId=${jobId}, state=${state}`);
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`BullMQ Job 제거 실패: jobId=${jobId}, error=${message}`);
      return false;
    }
  }

  /**
   * 특정 스케줄의 대기 중인 작업이 있는지 확인
   * @param scheduleId 스케줄 ID
   * @returns 대기 중인 Job ID 목록
   */
  async findPendingJobsBySchedule(scheduleId: string): Promise<string[]> {
    try {
      // 대기 중인 모든 작업 조회
      const waitingJobs = await this.cafeJobsQueue.getJobs(['waiting', 'delayed']);
      
      const pendingJobIds: string[] = [];
      for (const job of waitingJobs) {
        const payload = job.data?.payload;
        if (payload?.scheduleId === scheduleId) {
          pendingJobIds.push(job.id || '');
        }
      }
      
      return pendingJobIds.filter(id => id);
    } catch (error) {
      this.logger.error(`대기 중인 Job 조회 실패: scheduleId=${scheduleId}`);
      return [];
    }
  }
}

