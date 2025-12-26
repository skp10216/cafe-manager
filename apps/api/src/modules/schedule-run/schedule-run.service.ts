/**
 * ScheduleRun 서비스
 * 스케줄 실행 이력 비즈니스 로직 (운영형 SaaS)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ScheduleRun, Prisma, RunStatus, BlockCode } from '@prisma/client';

/** ScheduleRun 생성/업데이트 입력 */
interface CreateOrUpdateRunInput {
  scheduleId: string;
  userId: string;
  runDate: Date;
  status: RunStatus;
  blockCode?: BlockCode | null;
  blockReason?: string | null;
}

@Injectable()
export class ScheduleRunService {
  private readonly logger = new Logger(ScheduleRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ScheduleRun 생성 또는 업데이트
   * - 기존에 BLOCKED/SKIPPED 상태로 있으면 업데이트
   * - 없으면 새로 생성
   */
  async createOrUpdate(data: CreateOrUpdateRunInput): Promise<ScheduleRun | null> {
    const { scheduleId, userId, runDate, status, blockCode, blockReason } = data;

    try {
      // 기존 레코드 확인
      const existing = await this.prisma.scheduleRun.findUnique({
        where: {
          scheduleId_runDate: { scheduleId, runDate },
        },
      });

      if (existing) {
        // 기존 레코드가 BLOCKED/SKIPPED면 업데이트 허용
        if (existing.status === 'BLOCKED' || existing.status === 'SKIPPED') {
          return await this.prisma.scheduleRun.update({
            where: { id: existing.id },
            data: {
              status,
              blockCode,
              blockReason,
              triggeredAt: new Date(),
            },
          });
        }

        // 이미 실행 중이거나 완료된 경우 null 반환
        this.logger.debug(
          `ScheduleRun already exists with status=${existing.status}: scheduleId=${scheduleId}`
        );
        return null;
      }

      // 새로 생성
      return await this.prisma.scheduleRun.create({
        data: {
          scheduleId,
          userId,
          runDate,
          status,
          blockCode,
          blockReason,
          totalJobs: 0,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        // 동시 요청으로 인한 중복
        this.logger.debug(
          `ScheduleRun duplicate: scheduleId=${scheduleId}, runDate=${runDate}`
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * ScheduleRun 생성 (중복 방지) - 레거시 호환
   */
  async createOrSkip(data: {
    scheduleId: string;
    userId: string;
    runDate: Date;
  }): Promise<ScheduleRun | null> {
    return this.createOrUpdate({
      ...data,
      status: 'PENDING',
    });
  }

  /**
   * 스케줄과 날짜로 Run 조회
   */
  async findByScheduleAndDate(
    scheduleId: string,
    runDate: Date,
  ): Promise<ScheduleRun | null> {
    return this.prisma.scheduleRun.findUnique({
      where: {
        scheduleId_runDate: { scheduleId, runDate },
      },
    });
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
   * Job 완료/실패/스킵 시 진행률 업데이트
   */
  async updateJobProgress(
    runId: string,
    jobStatus: 'completed' | 'failed' | 'skipped',
  ) {
    const run = await this.prisma.scheduleRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      this.logger.warn(`ScheduleRun not found: ${runId}`);
      return;
    }

    const updates: Prisma.ScheduleRunUpdateInput = {};

    if (jobStatus === 'completed') {
      updates.completedJobs = run.completedJobs + 1;
    } else if (jobStatus === 'failed') {
      updates.failedJobs = run.failedJobs + 1;
    } else if (jobStatus === 'skipped') {
      updates.skippedJobs = run.skippedJobs + 1;
    }

    // 첫 Job 시작 시각 기록
    if (!run.startedAt) {
      updates.startedAt = new Date();
    }

    // 모든 Job 완료 여부 확인
    const newCompleted = (updates.completedJobs as number) ?? run.completedJobs;
    const newFailed = (updates.failedJobs as number) ?? run.failedJobs;
    const newSkipped = (updates.skippedJobs as number) ?? run.skippedJobs;
    const totalProcessed = newCompleted + newFailed + newSkipped;

    if (totalProcessed >= run.totalJobs) {
      if (newFailed === 0) {
        updates.status = 'COMPLETED';
      } else if (newCompleted === 0) {
        updates.status = 'FAILED';
      } else {
        updates.status = 'FAILED';  // 부분 실패도 FAILED
      }
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

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 사용자별 최근 실행 이력 조회
   */
  async findByUser(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.scheduleRun.findMany({
        where: { userId },
        include: {
          schedule: {
            select: {
              id: true,
              name: true,
              template: {
                select: {
                  id: true,
                  name: true,
                  cafeName: true,
                  boardName: true,
                },
              },
            },
          },
          _count: {
            select: { jobs: true },
          },
        },
        orderBy: { runDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.scheduleRun.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
   * 오늘 실행 통계 조회
   */
  async getTodayStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const runs = await this.prisma.scheduleRun.findMany({
      where: {
        userId,
        runDate: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      total: runs.length,
      completed: runs.filter((r) => r.status === 'COMPLETED').length,
      failed: runs.filter((r) => r.status === 'FAILED').length,
      running: runs.filter((r) => r.status === 'RUNNING' || r.status === 'QUEUED').length,
      blocked: runs.filter((r) => r.status === 'BLOCKED').length,
      skipped: runs.filter((r) => r.status === 'SKIPPED').length,
    };
  }

  /**
   * 특정 날짜와 스케줄로 Run 조회 - 레거시 호환
   */
  async findByDateAndSchedule(scheduleId: string, runDate: Date) {
    return this.findByScheduleAndDate(scheduleId, runDate);
  }
}
