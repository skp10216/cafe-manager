/**
 * Dashboard 서비스
 * 대시보드 데이터 조회 비즈니스 로직
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
  IntegrationStatusResponse,
  IntegrationStatusType,
  JobSummaryResponse,
  MiniJobItem,
  TodayTimelineResponse,
  TimelineItem,
  TimelineStatus,
  NextRunResponse,
  NextRunItem,
  FailureSummaryResponse,
  FailureCategoryItem,
  ErrorCategory,
  ERROR_CATEGORY_LABELS,
  RecentResultsResponse,
  RecentResultItem,
  ActiveRunResponse,
  ActiveRunsResponse,
  ActiveRunInfo,
  ActiveRunEvent,
} from './dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==============================================
  // 1. 연동 상태 조회
  // ==============================================

  /**
   * 네이버 연동 상태 조회
   * - 계정/세션 존재 여부 및 상태 확인
   * - 마지막 검증 시간 기반 상태 판단
   */
  async getIntegrationStatus(userId: string): Promise<IntegrationStatusResponse> {
    // 사용자의 네이버 계정 + 세션 조회
    const account = await this.prisma.naverAccount.findFirst({
      where: { userId },
      include: {
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // #region agent log
    this.logger.debug(
      `[DEBUG:getIntegrationStatus] userId=${userId}, ` +
      `accountId=${account?.id || 'null'}, ` +
      `sessionId=${account?.sessions[0]?.id || 'null'}, ` +
      `sessionStatus=${account?.sessions[0]?.status || 'null'}, ` +
      `lastVerifiedAt=${account?.sessions[0]?.lastVerifiedAt?.toISOString() || 'null'}`
    );
    // #endregion

    // 계정이 없는 경우
    if (!account) {
      return {
        status: 'NOT_CONNECTED',
        statusReason: '네이버 계정이 연동되지 않았습니다',
        account: null,
        session: null,
      };
    }

    const session = account.sessions[0];

    // 세션이 없는 경우
    if (!session) {
      return {
        status: 'NOT_CONNECTED',
        statusReason: '네이버 세션이 생성되지 않았습니다',
        account: {
          loginId: this.maskLoginId(account.loginId),
          displayName: account.displayName,
        },
        session: null,
      };
    }

    // 세션 상태에 따른 판단
    const { status, statusReason } = this.determineIntegrationStatus(session);

    return {
      status,
      statusReason,
      account: {
        loginId: this.maskLoginId(account.loginId),
        displayName: account.displayName,
      },
      session: {
        id: session.id,
        status: session.status,
        lastVerifiedAt: session.lastVerifiedAt?.toISOString() ?? null,
        errorMessage: session.errorMessage,
        naverNickname: session.naverNickname,
      },
    };
  }

  /**
   * 세션 상태 기반 연동 상태 판단
   */
  private determineIntegrationStatus(session: {
    status: string;
    lastVerifiedAt: Date | null;
    errorMessage: string | null;
  }): { status: IntegrationStatusType; statusReason: string } {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    switch (session.status) {
      case 'HEALTHY':
        // 마지막 검증이 24시간 이내면 정상
        if (session.lastVerifiedAt && session.lastVerifiedAt > twentyFourHoursAgo) {
          return { status: 'OK', statusReason: '정상 동작 중' };
        }
        // 24시간 초과면 주의
        return { status: 'WARNING', statusReason: '세션 상태 확인이 필요합니다' };

      case 'PENDING':
        return { status: 'WARNING', statusReason: '세션 연동 진행 중...' };

      case 'EXPIRING':
        return { status: 'WARNING', statusReason: '세션 만료가 임박했습니다. 재연동을 권장합니다' };

      case 'EXPIRED':
        return { status: 'ACTION_REQUIRED', statusReason: '세션이 만료되었습니다. 재연동이 필요합니다' };

      case 'CHALLENGE_REQUIRED':
        return { status: 'ACTION_REQUIRED', statusReason: '추가 인증이 필요합니다. 네이버 연동 페이지를 확인해주세요' };

      case 'ERROR':
        return {
          status: 'ACTION_REQUIRED',
          statusReason: session.errorMessage || '세션에 오류가 발생했습니다',
        };

      default:
        return { status: 'ACTION_REQUIRED', statusReason: '알 수 없는 상태입니다' };
    }
  }

  /**
   * 로그인 ID 마스킹
   * 예: "example@naver.com" → "exa***@naver.com"
   */
  private maskLoginId(loginId: string): string {
    if (!loginId) return '***';
    
    const atIndex = loginId.indexOf('@');
    if (atIndex > 0) {
      // 이메일 형식
      const prefix = loginId.substring(0, Math.min(3, atIndex));
      const suffix = loginId.substring(atIndex);
      return `${prefix}***${suffix}`;
    } else {
      // 일반 아이디
      const prefix = loginId.substring(0, Math.min(3, loginId.length));
      return `${prefix}***`;
    }
  }

  // ==============================================
  // 2. 작업 요약 조회
  // ==============================================

  /**
   * 작업 요약 조회 (대시보드 카드용)
   */
  async getJobSummary(userId: string): Promise<JobSummaryResponse> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 병렬로 모든 데이터 조회
    const [
      todayTotal,
      todayCompleted,
      todayFailed,
      processing,
      recentTodayJobs,
      recentCompletedJobs,
      recentFailedJobs,
      processingJobs,
    ] = await Promise.all([
      // 오늘 전체
      this.prisma.job.count({
        where: { userId, createdAt: { gte: todayStart } },
      }),
      // 오늘 완료
      this.prisma.job.count({
        where: { userId, createdAt: { gte: todayStart }, status: 'COMPLETED' },
      }),
      // 오늘 실패
      this.prisma.job.count({
        where: { userId, createdAt: { gte: todayStart }, status: 'FAILED' },
      }),
      // 현재 처리 중
      this.prisma.job.count({
        where: { userId, status: 'PROCESSING' },
      }),
      // 최근 오늘 작업 3개
      this.prisma.job.findMany({
        where: { userId, createdAt: { gte: todayStart } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      // 최근 완료 3개
      this.prisma.job.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        take: 3,
      }),
      // 최근 실패 3개
      this.prisma.job.findMany({
        where: { userId, status: 'FAILED' },
        orderBy: { finishedAt: 'desc' },
        take: 3,
      }),
      // 현재 처리 중 3개
      this.prisma.job.findMany({
        where: { userId, status: 'PROCESSING' },
        orderBy: { startedAt: 'desc' },
        take: 3,
      }),
    ]);

    return {
      today: {
        total: todayTotal,
        completed: todayCompleted,
        failed: todayFailed,
        processing,
      },
      cards: {
        todayJobs: {
          count: todayTotal,
          recent: recentTodayJobs.map(this.mapToMiniJobItem),
        },
        completed: {
          count: todayCompleted,
          recent: recentCompletedJobs.map(this.mapToMiniJobItem),
        },
        failed: {
          count: todayFailed,
          recent: recentFailedJobs.map(this.mapToMiniJobItem),
        },
        processing: {
          count: processing,
          recent: processingJobs.map(this.mapToMiniJobItem),
        },
      },
    };
  }

  /**
   * Job을 MiniJobItem으로 변환
   */
  private mapToMiniJobItem = (job: {
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    finishedAt: Date | null;
    payload: unknown;
    errorMessage: string | null;
  }): MiniJobItem => {
    const payload = (job.payload as Record<string, unknown>) || {};
    
    return {
      jobId: job.id,
      type: job.type,
      templateName: (payload.templateName as string) || null,
      scheduleName: (payload.scheduleName as string) || null,
      cafeName: (payload.cafeName as string) || null,
      boardName: (payload.boardName as string) || null,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
      status: job.status,
      resultUrl: (payload.resultUrl as string) || null,
      errorCategory: (payload.errorCategory as ErrorCategory) || null,
      errorSummary: (payload.errorSummary as string) || job.errorMessage || null,
    };
  };

  // ==============================================
  // 3. 오늘 타임라인 조회
  // ==============================================

  /**
   * 오늘 예정된 스케줄 타임라인 조회
   * Schedule에는 nextRunAt이 없고 runTime(HH:mm)을 사용
   */
  async getTodayTimeline(userId: string): Promise<TodayTimelineResponse> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const today = todayStart.toISOString().slice(0, 10); // YYYY-MM-DD

    // 활성 스케줄 조회 (오늘 아직 실행 안됨 또는 한 번도 실행 안됨)
    const schedules = await this.prisma.schedule.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        OR: [
          { lastRunDate: null },
          { lastRunDate: { lt: todayStart } },
        ],
      },
      include: {
        template: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { runTime: 'asc' },
    });

    // 오늘 실행된 Job 조회 (CREATE_POST만)
    const todayJobs = await this.prisma.job.findMany({
      where: {
        userId,
        type: 'CREATE_POST',
        createdAt: { gte: todayStart },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 스케줄별 최근 Job 상태 매핑
    const scheduleJobMap = new Map<string, typeof todayJobs[0]>();
    for (const job of todayJobs) {
      const payload = job.payload as Record<string, unknown>;
      const scheduleId = payload?.scheduleId as string;
      if (scheduleId && !scheduleJobMap.has(scheduleId)) {
        scheduleJobMap.set(scheduleId, job);
      }
    }

    // 타임라인 아이템 생성
    const items: TimelineItem[] = schedules.map((schedule) => {
      const relatedJob = scheduleJobMap.get(schedule.id);
      let status: TimelineStatus = 'SCHEDULED';
      let relatedJobId: string | undefined;
      let resultUrl: string | undefined;
      let errorSummary: string | undefined;

      if (relatedJob) {
        relatedJobId = relatedJob.id;
        const payload = relatedJob.payload as Record<string, unknown>;
        
        switch (relatedJob.status) {
          case 'PROCESSING':
            status = 'PROCESSING';
            break;
          case 'COMPLETED':
            status = 'COMPLETED';
            resultUrl = payload?.resultUrl as string;
            break;
          case 'FAILED':
            status = 'FAILED';
            errorSummary = (payload?.errorSummary as string) || relatedJob.errorMessage || '알 수 없는 오류';
            break;
        }
      }

      const thumbnail = schedule.template.images[0];
      
      // runTime을 오늘 날짜와 결합하여 nextRunAt 계산
      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const nextRunDate = new Date(todayStart);
      nextRunDate.setHours(hours, minutes, 0, 0);

      return {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        templateId: schedule.templateId,
        templateName: schedule.template.name,
        cafeId: schedule.template.cafeId,
        cafeName: schedule.template.cafeName || schedule.template.cafeId,
        boardId: schedule.template.boardId,
        boardName: schedule.template.boardName || schedule.template.boardId,
        nextRunAt: nextRunDate.toISOString(),
        status,
        preview: {
          subject: schedule.template.subjectTemplate,
          contentSnippet: this.truncateContent(schedule.template.contentTemplate, 100),
          thumbnailUrl: thumbnail?.url || null,
          imageCount: schedule.template.images.length,
        },
        relatedJobId,
        resultUrl,
        errorSummary,
      };
    });

    // 통계 계산
    const completedToday = items.filter((i) => i.status === 'COMPLETED').length;
    const failedToday = items.filter((i) => i.status === 'FAILED').length;

    return {
      items,
      totalScheduledToday: items.length,
      completedToday,
      failedToday,
    };
  }

  /**
   * 콘텐츠 자르기 (HTML 태그 제거 후)
   */
  private truncateContent(content: string, maxLength: number): string {
    // HTML 태그 제거
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + '...';
  }

  // ==============================================
  // 4. Next Run TOP N 조회
  // ==============================================

  /**
   * 다음 실행 예정 스케줄 TOP N 조회
   * Schedule에는 nextRunAt이 없고 runTime(HH:mm)을 사용
   */
  async getNextRun(userId: string, limit: number = 3): Promise<NextRunResponse> {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 오늘 실행 예정인 활성 스케줄 조회 (현재 시간 이후)
    const schedules = await this.prisma.schedule.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        runTime: { gt: currentTime }, // 현재 시간 이후
        OR: [
          { lastRunDate: null },
          { lastRunDate: { lt: todayStart } },
        ],
      },
      include: {
        template: {
          select: {
            name: true,
            cafeName: true,
            boardName: true,
          },
        },
      },
      orderBy: { runTime: 'asc' },
      take: limit,
    });

    const items: NextRunItem[] = schedules.map((schedule) => {
      // runTime을 오늘 날짜와 결합하여 nextRunAt 계산
      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const nextRunDate = new Date(todayStart);
      nextRunDate.setHours(hours, minutes, 0, 0);
      
      const remainingMs = nextRunDate.getTime() - now.getTime();
      const remainingMinutes = Math.max(0, Math.floor(remainingMs / (1000 * 60)));

      return {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        templateName: schedule.template.name,
        cafeName: schedule.template.cafeName || '카페',
        boardName: schedule.template.boardName || '게시판',
        nextRunAt: nextRunDate.toISOString(),
        remainingMinutes,
      };
    });

    return { items };
  }

  // ==============================================
  // 5. 실패 요약 조회
  // ==============================================

  /**
   * 실패 원인 카테고리별 요약 조회
   */
  async getFailureSummary(
    userId: string,
    period: 'TODAY' | 'WEEK' = 'TODAY'
  ): Promise<FailureSummaryResponse> {
    const now = new Date();
    let startDate: Date;

    if (period === 'TODAY') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 실패한 Job 조회
    const failedJobs = await this.prisma.job.findMany({
      where: {
        userId,
        status: 'FAILED',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 카테고리별 집계
    const categoryCount = new Map<ErrorCategory, { count: number; latestJobId: string }>();
    
    for (const job of failedJobs) {
      const payload = job.payload as Record<string, unknown>;
      const category = (payload?.errorCategory as ErrorCategory) || 'UNKNOWN';
      
      const existing = categoryCount.get(category);
      if (existing) {
        existing.count++;
      } else {
        categoryCount.set(category, { count: 1, latestJobId: job.id });
      }
    }

    // 상위 5개 카테고리 추출
    const totalFailures = failedJobs.length;
    const sortedCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const topCategories: FailureCategoryItem[] = sortedCategories.map(([category, data]) => ({
      category,
      label: ERROR_CATEGORY_LABELS[category] || '알 수 없음',
      count: data.count,
      percentage: totalFailures > 0 ? Math.round((data.count / totalFailures) * 100) : 0,
      latestJobId: data.latestJobId,
    }));

    return {
      topCategories,
      totalFailures,
      period,
    };
  }

  // ==============================================
  // 6. 최근 결과 조회
  // ==============================================

  /**
   * 최근 작업 결과 조회
   */
  async getRecentResults(
    userId: string,
    limit: number = 10,
    filter?: 'ALL' | 'SUCCESS' | 'FAILED'
  ): Promise<RecentResultsResponse> {
    const where: Record<string, unknown> = {
      userId,
      type: 'CREATE_POST', // 게시글 작성만
      status: { in: ['COMPLETED', 'FAILED'] },
    };

    if (filter === 'SUCCESS') {
      where.status = 'COMPLETED';
    } else if (filter === 'FAILED') {
      where.status = 'FAILED';
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { finishedAt: 'desc' },
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    const items: RecentResultItem[] = jobs.map((job) => {
      const payload = (job.payload as Record<string, unknown>) || {};
      
      let durationSeconds: number | null = null;
      if (job.startedAt && job.finishedAt) {
        durationSeconds = Math.round(
          (job.finishedAt.getTime() - job.startedAt.getTime()) / 1000
        );
      }

      return {
        jobId: job.id,
        type: job.type,
        templateName: (payload.templateName as string) || null,
        scheduleName: (payload.scheduleName as string) || null,
        cafeName: (payload.cafeName as string) || null,
        boardName: (payload.boardName as string) || null,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
        durationSeconds,
        resultUrl: (payload.resultUrl as string) || null,
        screenshotUrl: (payload.screenshotUrl as string) || null,
        errorCategory: (payload.errorCategory as ErrorCategory) || null,
        errorSummary: (payload.errorSummary as string) || job.errorMessage || null,
      };
    });

    return { items, total };
  }

  // ==============================================
  // 7. Active Run 조회 (실행 중 프로세스 추적)
  // ==============================================

  /**
   * 현재 실행 중인 ScheduleRun 조회 (대시보드 폴링용)
   * 
   * - RUNNING 상태의 최신 run 1개를 반환
   * - 없으면 { run: null, recentEvents: [] }
   * - 최근 5개 완료/실패 Job을 recentEvents로 제공
   */
  async getActiveRun(userId: string): Promise<ActiveRunResponse> {
    // 1단계: RUNNING 또는 QUEUED 상태의 최신 run 조회
    // (QUEUED도 포함하여 "대기 중" 상태도 표시)
    let run = await this.prisma.scheduleRun.findFirst({
      where: {
        userId,
        status: { in: ['RUNNING', 'QUEUED'] },
      },
      include: {
        schedule: {
          select: { name: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // RUNNING 우선 (알파벳순 QUEUED < RUNNING)
        { startedAt: 'desc' },
        { triggeredAt: 'desc' },
      ],
    });

    // 2단계: RUNNING/QUEUED가 없으면, 최근 30초 이내 완료된 run 표시 (깜빡임 방지)
    if (!run) {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      run = await this.prisma.scheduleRun.findFirst({
        where: {
          userId,
          status: { in: ['COMPLETED', 'FAILED'] },
          finishedAt: { gte: thirtySecondsAgo },
        },
        include: {
          schedule: {
            select: { name: true },
          },
        },
        orderBy: { finishedAt: 'desc' },
      });

      // 최근 완료된 run도 없으면 null 반환
      if (!run) {
        return { run: null, recentEvents: [] };
      }
    }

    // 3단계: "Stuck" 상태 자동 복구 (RUNNING이지만 모든 Job 완료된 경우)
    const processedCount = run.completedJobs + run.failedJobs;
    if (run.status === 'RUNNING' && processedCount >= run.totalJobs && run.totalJobs > 0) {
      this.logger.warn(
        `[Auto-Recovery] ScheduleRun ${run.id} is stuck in RUNNING state ` +
        `(${processedCount}/${run.totalJobs}). Auto-completing...`
      );
      
      const finalStatus = run.failedJobs === 0 ? 'COMPLETED' : 'FAILED';
      const updatedRun = await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: finalStatus,
          finishedAt: new Date(),
        },
        include: {
          schedule: {
            select: { name: true },
          },
        },
      });
      
      this.logger.log(
        `[Auto-Recovery] ScheduleRun ${run.id} → ${finalStatus} ` +
        `(${run.completedJobs} completed, ${run.failedJobs} failed)`
      );
      
      // 복구 후에도 완료된 run 정보를 반환 (깜빡임 방지)
      run = updatedRun;
    }

    // 4단계: 이 run의 최근 완료/실패 Job 5개 조회
    const recentJobs = await this.prisma.job.findMany({
      where: {
        scheduleRunId: run.id,
        status: { in: ['COMPLETED', 'FAILED'] },
      },
      orderBy: { finishedAt: 'desc' },
      take: 5,
      select: {
        sequenceNumber: true,
        status: true,
        errorCode: true,
        finishedAt: true,
      },
    });

    // 5단계: 응답 구성
    const runInfo: ActiveRunInfo = {
      id: run.id,
      scheduleId: run.scheduleId,
      scheduleName: run.schedule.name,
      status: run.status,
      totalTarget: run.totalJobs,
      processedCount: run.completedJobs + run.failedJobs,
      successCount: run.completedJobs,
      failedCount: run.failedJobs,
      updatedAt: run.updatedAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
    };

    const recentEvents: ActiveRunEvent[] = recentJobs.map((job) => ({
      index: job.sequenceNumber ?? 0,
      result: job.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED',
      errorCode: job.errorCode ?? undefined,
      createdAt: job.finishedAt?.toISOString() ?? '',
    }));

    return { run: runInfo, recentEvents };
  }

  // ==============================================
  // 8. Active Runs 조회 (복수 실행 지원)
  // ==============================================

  /**
   * 현재 실행 중인 모든 ScheduleRun 조회 (다중 스케줄 동시 실행 지원)
   * 
   * - RUNNING/QUEUED 상태의 모든 run을 반환
   * - 최근 30초 이내 완료된 run도 포함 (깜빡임 방지)
   * - 각 run별 최근 5개 이벤트 제공
   */
  async getActiveRuns(userId: string): Promise<ActiveRunsResponse> {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    // 1단계: RUNNING/QUEUED 상태의 모든 run 조회
    const runningRuns = await this.prisma.scheduleRun.findMany({
      where: {
        userId,
        status: { in: ['RUNNING', 'QUEUED'] },
      },
      include: {
        schedule: {
          select: { name: true },
        },
      },
      orderBy: [
        { status: 'asc' }, // RUNNING 우선
        { startedAt: 'desc' },
        { triggeredAt: 'desc' },
      ],
    });

    // 2단계: 최근 30초 이내 완료된 run도 포함 (깜빡임 방지)
    const recentlyCompletedRuns = await this.prisma.scheduleRun.findMany({
      where: {
        userId,
        status: { in: ['COMPLETED', 'FAILED'] },
        finishedAt: { gte: thirtySecondsAgo },
      },
      include: {
        schedule: {
          select: { name: true },
        },
      },
      orderBy: { finishedAt: 'desc' },
      take: 5, // 최근 완료 5개까지만
    });

    // 3단계: 중복 제거하여 병합
    const allRunIds = new Set<string>();
    const allRuns = [...runningRuns, ...recentlyCompletedRuns].filter(run => {
      if (allRunIds.has(run.id)) return false;
      allRunIds.add(run.id);
      return true;
    });

    // 4단계: "Stuck" 상태 자동 복구 처리
    const processedRuns: typeof allRuns = [];
    for (const run of allRuns) {
      const processedCount = run.completedJobs + run.failedJobs;
      
      if (run.status === 'RUNNING' && processedCount >= run.totalJobs && run.totalJobs > 0) {
        this.logger.warn(
          `[Auto-Recovery] ScheduleRun ${run.id} is stuck in RUNNING state ` +
          `(${processedCount}/${run.totalJobs}). Auto-completing...`
        );
        
        const finalStatus = run.failedJobs === 0 ? 'COMPLETED' : 'FAILED';
        const updatedRun = await this.prisma.scheduleRun.update({
          where: { id: run.id },
          data: {
            status: finalStatus,
            finishedAt: new Date(),
          },
          include: {
            schedule: {
              select: { name: true },
            },
          },
        });
        
        this.logger.log(
          `[Auto-Recovery] ScheduleRun ${run.id} → ${finalStatus} ` +
          `(${run.completedJobs} completed, ${run.failedJobs} failed)`
        );
        
        processedRuns.push(updatedRun);
      } else {
        processedRuns.push(run);
      }
    }

    // 5단계: 각 run의 최근 이벤트 조회 (병렬)
    const recentEventsByRunId: Record<string, ActiveRunEvent[]> = {};
    
    await Promise.all(
      processedRuns.map(async (run) => {
        const recentJobs = await this.prisma.job.findMany({
          where: {
            scheduleRunId: run.id,
            status: { in: ['COMPLETED', 'FAILED'] },
          },
          orderBy: { finishedAt: 'desc' },
          take: 5,
          select: {
            sequenceNumber: true,
            status: true,
            errorCode: true,
            finishedAt: true,
          },
        });

        recentEventsByRunId[run.id] = recentJobs.map((job) => ({
          index: job.sequenceNumber ?? 0,
          result: job.status === 'COMPLETED' ? 'SUCCESS' as const : 'FAILED' as const,
          errorCode: job.errorCode ?? undefined,
          createdAt: job.finishedAt?.toISOString() ?? '',
        }));
      })
    );

    // 6단계: 응답 구성
    const runs: ActiveRunInfo[] = processedRuns.map((run) => ({
      id: run.id,
      scheduleId: run.scheduleId,
      scheduleName: run.schedule.name,
      status: run.status,
      totalTarget: run.totalJobs,
      processedCount: run.completedJobs + run.failedJobs,
      successCount: run.completedJobs,
      failedCount: run.failedJobs,
      updatedAt: run.updatedAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
    }));

    return { runs, recentEventsByRunId };
  }
}

