/**
 * ScheduleRun 서비스
 * 스케줄 실행 이력 비즈니스 로직
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ScheduleRun, Prisma } from '@prisma/client';

@Injectable()
export class ScheduleRunService {
  private readonly logger = new Logger(ScheduleRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ScheduleRun 생성 (중복 방지)
   * unique 제약으로 하루 1회만 실행되도록 보장
   */
  async createOrSkip(data: {
    scheduleId: string;
    userId: string;
    runDate: Date;
  }): Promise<ScheduleRun | null> {
    try {
      return await this.prisma.scheduleRun.create({
        data: {
          scheduleId: data.scheduleId,
          userId: data.userId,
          runDate: data.runDate,
          status: 'PENDING',
          totalJobs: 0,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        // 이미 존재함 (중복 실행 방지)
        this.logger.debug(
          `ScheduleRun already exists: scheduleId=${data.scheduleId}, runDate=${data.runDate}`
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * ScheduleRun 업데이트
   */
  async update(runId: string, data: Partial<ScheduleRun>) {
    return this.prisma.scheduleRun.update({
      where: { id: runId },
      data,
    });
  }

  /**
   * Job 완료/실패 시 진행률 업데이트
   */
  async updateJobProgress(runId: string, jobStatus: 'completed' | 'failed') {
    const run = await this.prisma.scheduleRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      this.logger.warn(`ScheduleRun not found: ${runId}`);
      return;
    }

    const updates: Prisma.ScheduleRunUpdateInput = {
      completedJobs:
        jobStatus === 'completed' ? run.completedJobs + 1 : run.completedJobs,
      failedJobs: jobStatus === 'failed' ? run.failedJobs + 1 : run.failedJobs,
    };

    // 첫 Job 시작 시각 기록
    if (!run.startedAt) {
      updates.startedAt = new Date();
    }

    // 모든 Job 완료 여부 확인
    const newCompletedJobs =
      jobStatus === 'completed' ? run.completedJobs + 1 : run.completedJobs;
    const newFailedJobs =
      jobStatus === 'failed' ? run.failedJobs + 1 : run.failedJobs;

    if (newCompletedJobs + newFailedJobs >= run.totalJobs) {
      updates.status = newFailedJobs === 0 ? 'COMPLETED' : 'FAILED';
      updates.finishedAt = new Date();
    }

    return this.prisma.scheduleRun.update({
      where: { id: runId },
      data: updates,
    });
  }

  /**
   * 스케줄별 실행 이력 조회 (페이지네이션)
   */
  async findBySchedule(scheduleId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.scheduleRun.findMany({
        where: { scheduleId },
        include: {
          _count: {
            select: { jobs: true },
          },
        },
        orderBy: { runDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scheduleRun.count({ where: { scheduleId } }),
    ]);

    return { data, total };
  }

  /**
   * 특정 Run의 Job 목록 조회
   */
  async findJobsByRun(runId: string) {
    return this.prisma.job.findMany({
      where: { scheduleRunId: runId },
      orderBy: { sequenceNumber: 'asc' },
    });
  }

  /**
   * 특정 날짜와 스케줄로 Run 조회
   */
  async findByDateAndSchedule(scheduleId: string, runDate: Date) {
    return this.prisma.scheduleRun.findUnique({
      where: {
        scheduleId_runDate: {
          scheduleId,
          runDate,
        },
      },
    });
  }
}
