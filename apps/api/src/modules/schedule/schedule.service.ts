/**
 * Schedule 서비스
 * 스케줄 비즈니스 로직
 * 
 * [JIT 개선] 비활성화 시 pending Job 취소 로직 추가
 * [버그 수정] 실행 통계 (dailyRunCount, weeklyRunCount, lastRunStatus 등) enrichment 추가
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
  createPaginationMeta,
} from '@/common/dto/pagination.dto';
import { Schedule, ScheduleStatus, ScheduleRun } from '@prisma/client';
import { JobService } from '../job/job.service';

/** 실행 통계가 포함된 스케줄 응답 타입 */
export interface ScheduleWithStats extends Schedule {
  dailyRunCount: number;
  weeklyRunCount: number;
  lastRunStatus: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING' | null;
  lastRunFinishedAt: string | null;
  nextRunAt: string | null;
  recentFailures: Array<{
    id: string;
    runDate: string;
    failedJobs: number;
    message: string | null;
  }>;
  queueDelayedMinutes: number | null;
  limitExceeded: boolean;
  template?: {
    id: string;
    name: string;
    cafeId?: string;
    boardId?: string;
    cafeName?: string | null;
    boardName?: string | null;
  };
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => JobService))
    private readonly jobService: JobService,
  ) {}

  /**
   * 스케줄 목록 조회 (페이지네이션)
   * 실행 통계 (dailyRunCount, weeklyRunCount, lastRunStatus 등) 포함
   */
  async findAll(
    userId: string,
    query: PaginationQueryDto
  ): Promise<PaginatedResponse<ScheduleWithStats>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where: { userId },
        include: {
          template: {
            select: {
              id: true,
              name: true,
              cafeId: true,
              boardId: true,
              cafeName: true,
              boardName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.schedule.count({ where: { userId } }),
    ]);

    // 실행 통계 enrichment
    const enrichedData = await this.enrichSchedulesWithStats(data);

    return {
      data: enrichedData,
      meta: createPaginationMeta(page, limit, total),
    };
  }

  /**
   * 스케줄 상세 조회
   * 실행 통계 (dailyRunCount, weeklyRunCount, lastRunStatus 등) 포함
   */
  async findOne(id: string, userId: string): Promise<ScheduleWithStats> {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            cafeId: true,
            boardId: true,
            cafeName: true,
            boardName: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    if (schedule.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    // 실행 통계 enrichment
    const [enriched] = await this.enrichSchedulesWithStats([schedule]);
    return enriched;
  }

  /**
   * 스케줄 상세 조회 (내부용, 통계 없이)
   */
  private async findOneInternal(id: string, userId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        template: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    if (schedule.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    return schedule;
  }

  /**
   * 스케줄 생성
   * 새로 생성된 스케줄에 기본 통계 포함
   */
  async create(userId: string, dto: CreateScheduleDto): Promise<ScheduleWithStats> {
    const isImmediate = dto.scheduleType === 'IMMEDIATE';

    // SCHEDULED 타입일 때만 runTime 검증
    if (!isImmediate) {
      if (!dto.runTime || !/^\d{2}:\d{2}$/.test(dto.runTime)) {
        throw new BadRequestException(
          '실행 시간(runTime)은 HH:mm 형식으로 입력하세요 (예: 09:00)'
        );
      }
    }

    // 템플릿 존재 및 소유권 확인
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      select: {
        id: true,
        name: true,
        cafeId: true,
        boardId: true,
        cafeName: true,
        boardName: true,
        userId: true,
      },
    });

    if (!template) {
      throw new NotFoundException('템플릿을 찾을 수 없습니다');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('해당 템플릿에 접근할 수 없습니다');
    }

    // 스케줄 생성
    const schedule = await this.prisma.schedule.create({
      data: {
        userId,
        templateId: dto.templateId,
        name: dto.name,
        scheduleType: isImmediate ? 'IMMEDIATE' : 'SCHEDULED',
        runTime: dto.runTime || '09:00', // IMMEDIATE 타입은 기본값 사용
        dailyPostCount: dto.dailyPostCount ?? 10,
        postIntervalMinutes: dto.postIntervalMinutes ?? 5,
        timezone: dto.timezone ?? 'Asia/Seoul',
        // IMMEDIATE 타입은 즉시 활성화, SCHEDULED 타입은 비활성화 상태로 시작
        status: isImmediate ? 'ACTIVE' : 'PAUSED',
        userEnabled: isImmediate, // IMMEDIATE면 즉시 활성화
        adminStatus: 'APPROVED', // 자동 승인 처리
        nextPostAt: null,
        todayPostedCount: 0,
      },
    });

    // 새로 생성된 스케줄은 실행 기록이 없으므로 기본값으로 반환
    return {
      ...schedule,
      template: {
        id: template.id,
        name: template.name,
        cafeId: template.cafeId,
        boardId: template.boardId,
        cafeName: template.cafeName,
        boardName: template.boardName,
      },
      dailyRunCount: 0,
      weeklyRunCount: 0,
      lastRunStatus: null,
      lastRunFinishedAt: null,
      nextRunAt: schedule.nextPostAt?.toISOString() || null,
      recentFailures: [],
      queueDelayedMinutes: null,
      limitExceeded: false,
    };
  }

  /**
   * 스케줄 수정
   * 수정 후 실행 통계 포함하여 반환
   */
  async update(id: string, userId: string, dto: UpdateScheduleDto): Promise<ScheduleWithStats> {
    // 소유권 확인
    await this.findOneInternal(id, userId);

    // 템플릿 변경 시 소유권 확인
    if (dto.templateId) {
      const template = await this.prisma.template.findUnique({
        where: { id: dto.templateId },
      });

      if (!template || template.userId !== userId) {
        throw new ForbiddenException('해당 템플릿에 접근할 수 없습니다');
      }
    }

    const updated = await this.prisma.schedule.update({
      where: { id },
      data: dto,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            cafeId: true,
            boardId: true,
            cafeName: true,
            boardName: true,
          },
        },
      },
    });

    // 실행 통계 enrichment
    const [enriched] = await this.enrichSchedulesWithStats([updated]);
    return enriched;
  }

  /**
   * 스케줄 삭제
   */
  async remove(id: string, userId: string) {
    // 소유권 확인
    await this.findOneInternal(id, userId);

    await this.prisma.schedule.delete({
      where: { id },
    });
  }

  /**
   * 스케줄 상태 토글 (레거시 status 필드 사용)
   * [변경됨] 활성화 시 nextPostAt 초기화
   */
  async toggle(id: string, userId: string, status: ScheduleStatus) {
    // 소유권 확인
    const schedule = await this.findOneInternal(id, userId);
    const enabled = status === 'ACTIVE';

    // 활성화 시 nextPostAt 초기화
    let nextPostAt: Date | null = null;
    let todayPostedCount = schedule.todayPostedCount;

    if (enabled) {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const todayRunTime = new Date(todayStart);
      todayRunTime.setHours(hours, minutes, 0, 0);

      // 오늘 runTime이 지났으면 즉시 시작, 아니면 runTime에 시작
      nextPostAt = now > todayRunTime ? now : todayRunTime;

      // 하루가 바뀌었으면 카운터 초기화
      if (!schedule.lastRunDate || schedule.lastRunDate < todayStart) {
        todayPostedCount = 0;
      }
    }

    return this.prisma.schedule.update({
      where: { id },
      data: { 
        status,
        userEnabled: enabled,
        nextPostAt,
        todayPostedCount,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 사용자 활성화 토글 (userEnabled)
   * 
   * [JIT 개선]
   * - 활성화 시: nextPostAt 초기화
   * - 비활성화 시: nextPostAt=null + pending Job 취소
   */
  async toggleUserEnabled(id: string, userId: string, enabled: boolean) {
    // 소유권 확인
    const schedule = await this.findOneInternal(id, userId);

    // 활성화 시 nextPostAt 초기화
    let nextPostAt: Date | null = null;
    let todayPostedCount = schedule.todayPostedCount;

    if (enabled) {
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const todayRunTime = new Date(todayStart);
      todayRunTime.setHours(hours, minutes, 0, 0);

      // 오늘 runTime이 지났으면 즉시 시작, 아니면 runTime에 시작
      nextPostAt = now > todayRunTime ? now : todayRunTime;

      // 하루가 바뀌었으면 카운터 초기화
      if (!schedule.lastRunDate || schedule.lastRunDate < todayStart) {
        todayPostedCount = 0;
      }
    } else {
      // [JIT 개선] 비활성화 시 pending Job 취소
      try {
        const cancelledCount = await this.jobService.cancelPendingJobsBySchedule(id);
        if (cancelledCount > 0) {
          this.logger.log(`스케줄 ${id} 비활성화: ${cancelledCount}개 pending Job 취소됨`);
        }
      } catch (error) {
        this.logger.warn(`스케줄 ${id} pending Job 취소 실패: ${error}`);
        // 취소 실패해도 비활성화는 계속 진행
      }
    }

    return this.prisma.schedule.update({
      where: { id },
      data: {
        userEnabled: enabled,
        status: enabled ? 'ACTIVE' : 'PAUSED', // 레거시 호환
        nextPostAt,
        todayPostedCount,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 실행 대상 스케줄 조회 (Runner에서 사용)
   * - 시간 기반 조회 (runTime 매칭)
   * - 템플릿 정보 + 이미지 목록 포함
   */
  async findSchedulesToRun(currentTime: string, currentDate: string) {
    return this.prisma.schedule.findMany({
      where: {
        status: 'ACTIVE',
        runTime: currentTime,  // "09:00" 매칭
        OR: [
          { lastRunDate: null },  // 한 번도 실행 안됨
          { lastRunDate: { lt: new Date(currentDate) } }  // 오늘 아직 실행 안함
        ]
      },
      include: {
        template: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                path: true,
                order: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 스케줄 실행 후 lastRunDate 업데이트
   */
  async markAsRun(id: string) {
    await this.prisma.schedule.update({
      where: { id },
      data: {
        lastRunDate: new Date(),  // 오늘 날짜로 업데이트
      },
    });
  }

  // ============================================
  // Private: 실행 통계 Enrichment
  // ============================================

  /**
   * 스케줄 목록에 실행 통계 추가
   * - dailyRunCount: 오늘 실행 회수
   * - weeklyRunCount: 이번 주 실행 회수
   * - lastRunStatus: 최근 실행 결과
   * - lastRunFinishedAt: 최근 실행 완료 시간
   * - nextRunAt: 다음 실행 예정 시간
   * - recentFailures: 최근 실패 이력
   */
  private async enrichSchedulesWithStats(
    schedules: Array<Schedule & { template?: any }>
  ): Promise<ScheduleWithStats[]> {
    if (schedules.length === 0) return [];

    const scheduleIds = schedules.map((s) => s.id);
    const now = new Date();

    // 오늘 시작 시각
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 이번 주 시작 (월요일 기준)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 월요일로 조정
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    // 병렬로 통계 조회
    const [dailyRuns, weeklyRuns, latestRuns, recentFailedRuns] = await Promise.all([
      // 1. 오늘 실행 회수 (스케줄별)
      this.prisma.scheduleRun.groupBy({
        by: ['scheduleId'],
        where: {
          scheduleId: { in: scheduleIds },
          runDate: { gte: todayStart },
          status: { in: ['COMPLETED', 'FAILED', 'RUNNING'] }, // 실제 실행된 것만
        },
        _count: { id: true },
      }),

      // 2. 이번 주 실행 회수 (스케줄별)
      this.prisma.scheduleRun.groupBy({
        by: ['scheduleId'],
        where: {
          scheduleId: { in: scheduleIds },
          runDate: { gte: weekStart },
          status: { in: ['COMPLETED', 'FAILED', 'RUNNING'] },
        },
        _count: { id: true },
      }),

      // 3. 각 스케줄의 최근 실행 기록 (가장 최근 1개)
      this.prisma.scheduleRun.findMany({
        where: {
          scheduleId: { in: scheduleIds },
        },
        orderBy: { runDate: 'desc' },
        distinct: ['scheduleId'],
        select: {
          scheduleId: true,
          status: true,
          finishedAt: true,
          failedJobs: true,
          blockReason: true,
        },
      }),

      // 4. 최근 실패 이력 (최근 5개)
      this.prisma.scheduleRun.findMany({
        where: {
          scheduleId: { in: scheduleIds },
          status: 'FAILED',
        },
        orderBy: { runDate: 'desc' },
        take: scheduleIds.length * 3, // 스케줄당 최대 3개
        select: {
          id: true,
          scheduleId: true,
          runDate: true,
          failedJobs: true,
          blockReason: true,
        },
      }),
    ]);

    // Map으로 변환하여 빠른 조회
    const dailyCountMap = new Map(
      dailyRuns.map((r) => [r.scheduleId, r._count.id])
    );
    const weeklyCountMap = new Map(
      weeklyRuns.map((r) => [r.scheduleId, r._count.id])
    );
    const latestRunMap = new Map(
      latestRuns.map((r) => [r.scheduleId, r])
    );

    // 실패 이력 스케줄별로 그룹화
    const failuresMap = new Map<string, typeof recentFailedRuns>();
    for (const run of recentFailedRuns) {
      const list = failuresMap.get(run.scheduleId) || [];
      if (list.length < 3) { // 스케줄당 최대 3개
        list.push(run);
      }
      failuresMap.set(run.scheduleId, list);
    }

    // 각 스케줄에 통계 추가
    return schedules.map((schedule) => {
      const latestRun = latestRunMap.get(schedule.id);
      const failures = failuresMap.get(schedule.id) || [];

      // lastRunStatus 변환
      let lastRunStatus: ScheduleWithStats['lastRunStatus'] = null;
      if (latestRun) {
        switch (latestRun.status) {
          case 'COMPLETED':
            lastRunStatus = 'SUCCESS';
            break;
          case 'FAILED':
            lastRunStatus = 'FAILED';
            break;
          case 'RUNNING':
            lastRunStatus = 'RUNNING';
            break;
          case 'PENDING':
          case 'QUEUED':
            lastRunStatus = 'PENDING';
            break;
          default:
            lastRunStatus = null;
        }
      }

      // 일일 제한 초과 여부
      const dailyCount = dailyCountMap.get(schedule.id) || 0;
      const limitExceeded = dailyCount >= schedule.dailyPostCount;

      return {
        ...schedule,
        dailyRunCount: dailyCountMap.get(schedule.id) || 0,
        weeklyRunCount: weeklyCountMap.get(schedule.id) || 0,
        lastRunStatus,
        lastRunFinishedAt: latestRun?.finishedAt?.toISOString() || null,
        nextRunAt: schedule.nextPostAt?.toISOString() || null,
        recentFailures: failures.map((f) => ({
          id: f.id,
          runDate: f.runDate.toISOString(),
          failedJobs: f.failedJobs,
          message: f.blockReason || null,
        })),
        queueDelayedMinutes: null, // TODO: 큐 지연 시간 계산 (향후 구현)
        limitExceeded,
      };
    });
  }
}

