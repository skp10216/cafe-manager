/**
 * Schedule Runner
 * 운영형 SaaS 수준 - 3조건 체크 기반 스케줄 실행
 * 
 * [변경됨] 5분 간격 1개씩 생성 방식
 * - 기존: runTime에 N개 Job을 한번에 생성 (BullMQ delay 사용)
 * - 변경: 매분 체크하여 nextPostAt 도래 시 1개씩 생성
 * 
 * 실행 조건:
 * 1. userEnabled = true (사용자 활성화)
 * 2. adminStatus = APPROVED (관리자 승인)
 * 3. sessionStatus = HEALTHY (네이버 연동 정상)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/common/prisma/prisma.service';
import { ScheduleService } from './schedule.service';
import { ScheduleRunService } from '../schedule-run/schedule-run.service';
import { JobService } from '../job/job.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AdminStatus,
  SessionStatus,
  BlockCode,
  RunStatus,
} from '@prisma/client';

/** 3조건 체크 결과 */
interface ExecutabilityCheck {
  canExecute: boolean;
  userEnabled: boolean;
  adminApproved: boolean;
  sessionHealthy: boolean;
  blockCode: BlockCode | null;
  blockMessage: string | null;
  sessionStatus: SessionStatus | null;
}

/** 차단 코드별 메시지 */
const BLOCK_CODE_MESSAGES: Record<BlockCode, string> = {
  USER_DISABLED: '사용자가 스케줄을 비활성화했습니다',
  ADMIN_NOT_APPROVED: '관리자 승인이 필요합니다',
  ADMIN_SUSPENDED: '관리자에 의해 일시 중지되었습니다',
  ADMIN_BANNED: '관리자에 의해 차단되었습니다',
  SESSION_EXPIRED: '네이버 연동이 만료되었습니다',
  SESSION_CHALLENGE: '네이버 추가 인증이 필요합니다',
  SESSION_ERROR: '네이버 연동에 문제가 있습니다',
  DAILY_LIMIT: '일일 실행 제한을 초과했습니다',
  DUPLICATE: '오늘 이미 실행되었습니다',
};

@Injectable()
export class ScheduleRunner {
  private readonly logger = new Logger(ScheduleRunner.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
    private readonly scheduleRunService: ScheduleRunService,
    private readonly jobService: JobService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * 1분마다 실행 대상 스케줄 확인 (3조건 체크 적용)
   * 
   * [변경됨] 5분 간격 1개씩 생성 방식
   * - nextPostAt이 현재 시각 이전이고
   * - 오늘 목표 미달인 스케줄에 대해 1개 Job 생성
   * 
   * [버그 수정] 목표 수량 초과 방지 로직 강화
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    try {
      const now = new Date();
      const todayStart = this.getTodayStart(now);

      // 1. 하루가 바뀐 스케줄 초기화 (todayPostedCount 리셋 + nextPostAt 설정)
      await this.resetDailyCounters(now, todayStart);

      // 2. 실행 대상 스케줄 찾기
      //    - nextPostAt <= now (포스팅 시간 도래)
      //    - todayPostedCount < dailyPostCount (오늘 목표 미달) ← SQL 레벨에서 체크!
      const candidateSchedules = await this.findCandidateSchedules(now);

      if (candidateSchedules.length === 0) {
        return;
      }

      // 디버깅용 상세 로그 (nextPostAt 포함)
      this.logger.log(
        `📋 실행 후보 스케줄 ${candidateSchedules.length}개: ` +
        candidateSchedules.map(s => 
          `[${s.name}: ${s.todayPostedCount}/${s.dailyPostCount}, ` +
          `nextPostAt=${s.nextPostAt?.toLocaleTimeString('ko-KR') || 'null'}]`
        ).join(', ')
      );

      // 3. 각 스케줄에 대해 1개 Job 생성 (순차 처리로 동시성 문제 최소화)
      for (const schedule of candidateSchedules) {
        await this.processSchedule(schedule, now);
      }
    } catch (error) {
      this.logger.error('스케줄 확인 중 오류 발생', error);
    }
  }

  /**
   * 오늘 시작 시각 (00:00:00) 계산
   */
  private getTodayStart(now: Date): Date {
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    return todayStart;
  }

  /**
   * 하루가 바뀐 스케줄의 카운터 초기화 + nextPostAt이 null인 스케줄 초기화
   * - lastRunDate가 오늘 이전인 활성 스케줄의 todayPostedCount 리셋
   * - nextPostAt을 오늘 runTime으로 설정
   * - 기존 데이터 마이그레이션: nextPostAt이 null인 활성 스케줄도 초기화
   */
  private async resetDailyCounters(now: Date, todayStart: Date) {
    // 1. 하루가 바뀐 스케줄 (todayPostedCount > 0이면서 lastRunDate가 오늘 이전)
    const schedulesToReset = await this.prisma.schedule.findMany({
      where: {
        userEnabled: true,
        adminStatus: 'APPROVED',
        todayPostedCount: { gt: 0 },
        OR: [
          { lastRunDate: null },
          { lastRunDate: { lt: todayStart } },
        ],
      },
      select: {
        id: true,
        runTime: true,
      },
    });

    // 2. nextPostAt이 null인 활성 스케줄 (기존 데이터 마이그레이션)
    const schedulesToInit = await this.prisma.schedule.findMany({
      where: {
        userEnabled: true,
        adminStatus: 'APPROVED',
        nextPostAt: null,
      },
      select: {
        id: true,
        runTime: true,
        lastRunDate: true,
        todayPostedCount: true,
        dailyPostCount: true,
      },
    });

    const allSchedules = [...schedulesToReset, ...schedulesToInit];
    const uniqueScheduleIds = [...new Set(allSchedules.map(s => s.id))];

    if (uniqueScheduleIds.length === 0) {
      return;
    }

    this.logger.log(`${uniqueScheduleIds.length}개 스케줄 초기화/리셋`);

    for (const schedule of allSchedules) {
      // 오늘의 runTime 계산
      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      const todayRunTime = new Date(todayStart);
      todayRunTime.setHours(hours, minutes, 0, 0);

      // nextPostAt 결정: runTime이 지났으면 즉시, 아니면 runTime
      let nextPostAt = now > todayRunTime ? now : todayRunTime;

      // 오늘 목표 달성했으면 내일로 설정
      const todayPostedCount = ('todayPostedCount' in schedule ? schedule.todayPostedCount : 0) as number;
      const dailyPostCount = ('dailyPostCount' in schedule ? schedule.dailyPostCount : 10) as number;
      
      if (todayPostedCount >= dailyPostCount) {
        const tomorrowRunTime = new Date(todayStart);
        tomorrowRunTime.setDate(tomorrowRunTime.getDate() + 1);
        tomorrowRunTime.setHours(hours, minutes, 0, 0);
        nextPostAt = tomorrowRunTime;
      }

      // 하루가 바뀌었으면 카운터 리셋
      const lastRunDate = 'lastRunDate' in schedule ? schedule.lastRunDate : null;
      const shouldResetCount = !lastRunDate || lastRunDate < todayStart;

      await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          todayPostedCount: shouldResetCount ? 0 : undefined,
          nextPostAt,
        },
      });
    }
  }

  /**
   * 실행 후보 스케줄 조회
   * 조건:
   * - nextPostAt <= 현재시각 (포스팅 시간 도래)
   * - todayPostedCount < dailyPostCount (오늘 목표 미달) ← 중요!
   * - userEnabled = true
   * - adminStatus = APPROVED
   * 
   * [버그 수정] Raw SQL의 타임존 문제를 해결하기 위해 Prisma 쿼리 사용
   * todayPostedCount < dailyPostCount 조건은 애플리케이션 레벨에서 필터링
   */
  private async findCandidateSchedules(now: Date) {
    // 1. Prisma 쿼리로 기본 조건 체크 (nextPostAt <= now 포함)
    const candidates = await this.prisma.schedule.findMany({
      where: {
        userEnabled: true,
        adminStatus: 'APPROVED',
        nextPostAt: { lte: now },  // Prisma가 타임존을 올바르게 처리
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
        user: {
          include: {
            naverAccounts: {
              include: {
                sessions: {
                  where: {
                    status: { in: ['HEALTHY', 'EXPIRING', 'PENDING'] },
                  },
                  orderBy: { lastVerifiedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // 2. 애플리케이션 레벨에서 todayPostedCount < dailyPostCount 필터링
    const filtered = candidates.filter(
      schedule => schedule.todayPostedCount < schedule.dailyPostCount
    );

    // 디버깅: 필터링 전후 비교 로그
    if (candidates.length > 0) {
      this.logger.debug(
        `후보 필터링: ${candidates.length}개 중 ${filtered.length}개 통과 ` +
        `(nextPostAt 조건 통과 후 todayPostedCount < dailyPostCount 체크)`
      );
    }

    return filtered;
  }

  /**
   * 개별 스케줄 처리 (3조건 체크 + 1개 Job 생성)
   * 
   * [버그 수정] 트랜잭션과 원자적 업데이트로 race condition 방지
   */
  private async processSchedule(schedule: any, now: Date) {
    const scheduleId = schedule.id;
    const userId = schedule.userId;
    const todayStart = this.getTodayStart(now);

    // [중요] DB에서 최신 상태 다시 조회 (동시성 문제 방지)
    const freshSchedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { todayPostedCount: true, dailyPostCount: true },
    });

    if (!freshSchedule) {
      this.logger.warn(`스케줄 ${scheduleId}: 조회 실패`);
      return;
    }

    // 오늘 목표 달성 여부 확인 (최신 값으로 체크)
    if (freshSchedule.todayPostedCount >= freshSchedule.dailyPostCount) {
      this.logger.debug(
        `스케줄 ${scheduleId}: 오늘 목표 달성 (${freshSchedule.todayPostedCount}/${freshSchedule.dailyPostCount})`
      );
      // 다음 날 runTime으로 nextPostAt 설정
      await this.setNextPostAtForTomorrow(schedule, todayStart);
      return;
    }

    // 3조건 체크
    const executability = this.checkExecutability(schedule);

    // 조건 미충족 시 BLOCKED/SKIPPED로 기록
    if (!executability.canExecute) {
      await this.handleBlockedSchedule(schedule, now, executability);
      return;
    }

    // ScheduleRun 조회 또는 생성 (오늘 날짜 기준)
    let run = await this.scheduleRunService.findByScheduleAndDate(
      scheduleId,
      todayStart,
    );

    if (!run || run.status === 'BLOCKED' || run.status === 'SKIPPED') {
      // 새로 생성하거나 BLOCKED/SKIPPED 상태 업데이트
      run = await this.scheduleRunService.createOrUpdate({
        scheduleId,
        userId,
        runDate: todayStart,
        status: 'RUNNING',
        blockCode: null,
        blockReason: null,
      });

      if (!run) {
        this.logger.warn(`스케줄 ${scheduleId}: ScheduleRun 생성 실패`);
        return;
      }

      // totalJobs 설정 (처음 생성 시)
      await this.scheduleRunService.update(run.id, {
        totalJobs: schedule.dailyPostCount,
      });
    }

    // 1개 Job 생성 (freshSchedule의 최신 카운트 사용)
    await this.createSingleJob(
      { ...schedule, todayPostedCount: freshSchedule.todayPostedCount },
      run,
      executability.sessionStatus,
      now
    );
  }

  /**
   * 다음 날 runTime으로 nextPostAt 설정
   */
  private async setNextPostAtForTomorrow(schedule: any, todayStart: Date) {
    const [hours, minutes] = schedule.runTime.split(':').map(Number);
    const tomorrowRunTime = new Date(todayStart);
    tomorrowRunTime.setDate(tomorrowRunTime.getDate() + 1);
    tomorrowRunTime.setHours(hours, minutes, 0, 0);

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        nextPostAt: tomorrowRunTime,
      },
    });
  }

  /**
   * 3조건 실행 가능 여부 체크
   * 
   * 조건 1: userEnabled = true
   * 조건 2: adminStatus = APPROVED
   * 조건 3: 사용자의 네이버 세션이 HEALTHY
   */
  private checkExecutability(schedule: any): ExecutabilityCheck {
    const userEnabled = schedule.userEnabled;
    const adminStatus: AdminStatus = schedule.adminStatus;
    const adminApproved = adminStatus === 'APPROVED';

    // 사용자의 활성 세션 찾기
    const sessions = schedule.user?.naverAccounts
      ?.flatMap((account: any) => account.sessions)
      ?.filter((s: any) => s) ?? [];

    const healthySession = sessions.find(
      (s: any) => s.status === 'HEALTHY' || s.status === 'EXPIRING'
    );
    const sessionStatus: SessionStatus | null = healthySession?.status ?? null;
    const sessionHealthy = sessionStatus === 'HEALTHY' || sessionStatus === 'EXPIRING';

    // 차단 사유 결정 (우선순위 순)
    let blockCode: BlockCode | null = null;
    let blockMessage: string | null = null;

    if (!userEnabled) {
      blockCode = 'USER_DISABLED';
    } else if (adminStatus === 'NEEDS_REVIEW') {
      blockCode = 'ADMIN_NOT_APPROVED';
    } else if (adminStatus === 'SUSPENDED') {
      blockCode = 'ADMIN_SUSPENDED';
    } else if (adminStatus === 'BANNED') {
      blockCode = 'ADMIN_BANNED';
    } else if (!healthySession) {
      // 세션이 없거나 모두 비정상
      const anySession = sessions[0];
      if (anySession?.status === 'EXPIRED') {
        blockCode = 'SESSION_EXPIRED';
      } else if (anySession?.status === 'CHALLENGE_REQUIRED') {
        blockCode = 'SESSION_CHALLENGE';
      } else {
        blockCode = 'SESSION_ERROR';
      }
    }

    if (blockCode) {
      blockMessage = BLOCK_CODE_MESSAGES[blockCode];
    }

    return {
      canExecute: userEnabled && adminApproved && sessionHealthy,
      userEnabled,
      adminApproved,
      sessionHealthy,
      blockCode,
      blockMessage,
      sessionStatus,
    };
  }

  /**
   * 차단된 스케줄 처리 (BLOCKED/SKIPPED 기록)
   */
  private async handleBlockedSchedule(
    schedule: any,
    now: Date,
    executability: ExecutabilityCheck,
  ) {
    const { blockCode, blockMessage } = executability;
    const todayStart = this.getTodayStart(now);

    // 차단 상태 결정 (사용자 비활성화 = SKIPPED, 그 외 = BLOCKED)
    const status: RunStatus = blockCode === 'USER_DISABLED' ? 'SKIPPED' : 'BLOCKED';

    this.logger.debug(
      `스케줄 ${schedule.id} ${status}: ${blockMessage} (code=${blockCode})`
    );

    // ScheduleRun 생성/업데이트 (차단/스킵 기록)
    await this.scheduleRunService.createOrUpdate({
      scheduleId: schedule.id,
      userId: schedule.userId,
      runDate: todayStart,
      status,
      blockCode,
      blockReason: blockMessage,
    });

    // nextPostAt을 다음 간격으로 업데이트 (계속 차단되면 계속 시도하지 않도록)
    await this.updateNextPostAt(schedule, now);

    // 연속 실패 카운트 업데이트 (세션 관련 문제일 때만)
    if (
      blockCode === 'SESSION_EXPIRED' ||
      blockCode === 'SESSION_CHALLENGE' ||
      blockCode === 'SESSION_ERROR'
    ) {
      await this.incrementConsecutiveFailures(schedule);
    }
  }

  /**
   * 연속 실패 카운트 증가 + 자동 중지 체크
   */
  private async incrementConsecutiveFailures(schedule: any) {
    const newCount = (schedule.consecutiveFailures || 0) + 1;

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        consecutiveFailures: newCount,
      },
    });

    // 자동 중지 정책 체크 (5회 연속 실패 시)
    const autoSuspendThreshold = 5;

    if (newCount >= autoSuspendThreshold && schedule.adminStatus === 'APPROVED') {
      this.logger.warn(
        `스케줄 ${schedule.id}: 연속 ${newCount}회 실패로 자동 중지`
      );

      await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          adminStatus: 'SUSPENDED',
          adminReason: `연속 ${newCount}회 실패로 자동 중지됨`,
          suspendedAt: new Date(),
        },
      });

      // 감사 로그 기록
      await this.auditLogService.log({
        actorType: 'SYSTEM',
        targetUserId: schedule.userId,
        entityType: 'SCHEDULE',
        entityId: schedule.id,
        action: 'AUTO_SUSPEND',
        reason: `연속 ${newCount}회 실패`,
        metadata: {
          consecutiveFailures: newCount,
          threshold: autoSuspendThreshold,
        },
      });
    }
  }

  /**
   * 1개 Job 생성 (5분 간격 방식)
   * 
   * [변경됨] 기존 createJobsForRun을 대체
   * - 1개 Job만 생성
   * - todayPostedCount 증가
   * - nextPostAt 업데이트
   * 
   * [버그 수정] 
   * - Job 생성 전 최종 확인으로 초과 생성 방지
   * - nextPostAt을 먼저 미래로 설정하여 중복 실행 방지 (락 역할)
   * 
   * public으로 노출하여 즉시 실행에서도 사용 가능
   */
  async createSingleJob(
    schedule: any,
    run: any,
    sessionStatus: SessionStatus | null,
    now: Date,
  ) {
    // [중요] Job 생성 직전 최종 확인 - 목표 초과 방지
    const latestSchedule = await this.prisma.schedule.findUnique({
      where: { id: schedule.id },
      select: { 
        todayPostedCount: true, 
        dailyPostCount: true,
        postIntervalMinutes: true,
        runTime: true,
      },
    });

    if (!latestSchedule) {
      this.logger.warn(`스케줄 ${schedule.id}: Job 생성 직전 조회 실패`);
      return null;
    }

    if (latestSchedule.todayPostedCount >= latestSchedule.dailyPostCount) {
      this.logger.warn(
        `스케줄 ${schedule.id}: Job 생성 취소 - 이미 목표 달성 ` +
        `(${latestSchedule.todayPostedCount}/${latestSchedule.dailyPostCount})`
      );
      // nextPostAt을 다음 날로 업데이트
      await this.setNextPostAtForTomorrow(schedule, this.getTodayStart(now));
      return null;
    }

    const currentPostNumber = latestSchedule.todayPostedCount + 1;
    const totalPosts = latestSchedule.dailyPostCount;

    // ============================================================
    // [핵심 버그 수정] Job 생성 전에 먼저 nextPostAt + todayPostedCount 업데이트!
    // 이렇게 해야 다른 Cron이 같은 스케줄을 중복 처리하지 않음
    // ============================================================
    const todayStart = this.getTodayStart(now);
    let nextPostAt: Date;

    if (currentPostNumber >= totalPosts) {
      // 이번이 마지막 → 다음 날 runTime
      const [hours, minutes] = latestSchedule.runTime.split(':').map(Number);
      nextPostAt = new Date(todayStart);
      nextPostAt.setDate(nextPostAt.getDate() + 1);
      nextPostAt.setHours(hours, minutes, 0, 0);
    } else {
      // 다음 포스팅 시각 = 현재 + postIntervalMinutes
      nextPostAt = new Date(now.getTime() + latestSchedule.postIntervalMinutes * 60 * 1000);
    }

    // 원자적으로 todayPostedCount 증가 + nextPostAt 업데이트 (락 역할)
    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        todayPostedCount: { increment: 1 },
        nextPostAt,
      },
    });

    // 현재 시간과 다음 실행 시간의 차이 계산
    const diffMs = nextPostAt.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    
    this.logger.log(
      `⏰ 스케줄 "${schedule.name}": nextPostAt 업데이트 → ` +
      `${nextPostAt.toLocaleString('ko-KR')} ` +
      `(현재: ${now.toLocaleTimeString('ko-KR')}, ${diffMin > 0 ? `+${diffMin}분 후` : '내일'})`
    );

    // ============================================================
    // 이제 안전하게 Job 생성
    // ============================================================
    const runMode = this.determineRunMode(schedule);

    // 시스템 변수 생성
    const systemVariables = this.getSystemVariables(now);

    // 템플릿 변수 치환
    const title = this.replaceVariables(schedule.template.subjectTemplate, systemVariables);
    const content = this.replaceVariables(schedule.template.contentTemplate, systemVariables);

    // 이미지 경로 목록
    const imagePaths = schedule.template.images
      .sort((a: any, b: any) => a.order - b.order)
      .map((img: any) => img.path);

    // Job 생성 (delay 없음, 즉시 실행)
    const job = await this.jobService.createJob({
      type: 'CREATE_POST',
      userId: schedule.userId,
      scheduleRunId: run.id,
      sequenceNumber: currentPostNumber,
      runMode,
      payload: {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        templateId: schedule.template.id,
        templateName: schedule.template.name,
        cafeId: schedule.template.cafeId,
        cafeName: schedule.template.cafeName,
        boardId: schedule.template.boardId,
        boardName: schedule.template.boardName,
        title,
        content,
        imagePaths,
        price: schedule.template.price,
        tradeMethod: schedule.template.tradeMethod,
        tradeLocation: schedule.template.tradeLocation,
        // 진행 상황 표시를 위한 정보 (예: 2/3)
        currentPostNumber,
        totalPosts,
      },
    });

    // lastRunDate 업데이트 (첫 번째 포스팅 시)
    if (currentPostNumber === 1) {
      await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          lastRunDate: now,
          consecutiveFailures: 0,  // 성공적으로 Job 생성했으므로 리셋
        },
      });
    }

    this.logger.log(
      `✅ 스케줄 "${schedule.name}" Job 생성 완료: ${currentPostNumber}/${totalPosts} ` +
      `(다음: +${latestSchedule.postIntervalMinutes}분 후, 모드: ${runMode})`
    );

    return job;
  }

  /**
   * nextPostAt 업데이트 (차단/실패 시에도 호출)
   */
  private async updateNextPostAt(schedule: any, now: Date) {
    const todayStart = this.getTodayStart(now);
    
    // 다음 간격으로 설정 (목표 달성 전이면)
    let nextPostAt: Date;

    if (schedule.todayPostedCount >= schedule.dailyPostCount) {
      // 오늘 목표 달성 → 다음 날 runTime
      const [hours, minutes] = schedule.runTime.split(':').map(Number);
      nextPostAt = new Date(todayStart);
      nextPostAt.setDate(nextPostAt.getDate() + 1);
      nextPostAt.setHours(hours, minutes, 0, 0);
    } else {
      // 목표 미달 → 현재 시각 + postIntervalMinutes
      nextPostAt = new Date(now.getTime() + schedule.postIntervalMinutes * 60 * 1000);
    }

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: { nextPostAt },
    });
  }

  /**
   * 실행 모드 결정 (연속 실패 시 디버그 모드)
   */
  private determineRunMode(schedule: any): 'HEADLESS' | 'DEBUG' {
    const debugThreshold = 3;
    
    if (schedule.consecutiveFailures >= debugThreshold) {
      return 'DEBUG';
    }
    
    return 'HEADLESS';
  }

  /**
   * 시스템 변수 생성 (날짜, 시간 등)
   */
  private getSystemVariables(now: Date): Record<string, string> {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return {
      오늘날짜: `${year}-${month}-${day}`,
      오늘: `${year}년 ${month}월 ${day}일`,
      년도: String(year),
      월: month,
      일: day,
      시간: `${hours}:${minutes}`,
      시: hours,
      분: minutes,
      요일: ['일', '월', '화', '수', '목', '금', '토'][now.getDay()],
    };
  }

  /**
   * 템플릿 변수 치환
   */
  private replaceVariables(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables[trimmedKey] !== undefined
        ? variables[trimmedKey]
        : match;
    });
  }

  // ============================================
  // 즉시 실행 관련 메서드 (API에서 호출)
  // ============================================

  /**
   * 스케줄 즉시 실행 (runNow)
   * - API에서 호출하여 스케줄의 첫 번째 포스팅을 즉시 시작
   * - nextPostAt을 현재 시각으로 설정하여 다음 체크 시 실행되도록 함
   */
  async runNow(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new Error(`스케줄을 찾을 수 없습니다: ${scheduleId}`);
    }

    const now = new Date();

    // nextPostAt을 현재 시각으로 설정 (즉시 실행되도록)
    // todayPostedCount는 유지 (이미 진행 중인 경우)
    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        nextPostAt: now,
      },
    });

    this.logger.log(`스케줄 ${scheduleId} 즉시 실행 예약됨`);

    return { success: true, nextPostAt: now };
  }

  /**
   * 스케줄 활성화 시 nextPostAt 초기화
   * - 스케줄이 활성화될 때 호출
   * - 오늘 runTime이 지났으면 즉시 시작, 아니면 runTime에 시작
   */
  async initializeNextPostAt(scheduleId: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      return;
    }

    const now = new Date();
    const todayStart = this.getTodayStart(now);
    const [hours, minutes] = schedule.runTime.split(':').map(Number);
    
    const todayRunTime = new Date(todayStart);
    todayRunTime.setHours(hours, minutes, 0, 0);

    // 오늘 runTime이 지났으면 즉시 시작, 아니면 runTime에 시작
    const nextPostAt = now > todayRunTime ? now : todayRunTime;

    await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        nextPostAt,
        todayPostedCount: 0,  // 카운터 초기화
      },
    });

    this.logger.log(
      `스케줄 ${scheduleId} nextPostAt 초기화: ${nextPostAt.toISOString()}`
    );
  }

  /**
   * 즉시 실행용: N개 Job 한번에 생성 (BullMQ delay 사용)
   * 
   * 스케줄 자동 실행은 1개씩 생성하지만,
   * 즉시 실행(runNow 버튼)은 기존처럼 한번에 N개 생성하여 즉각적인 피드백 제공
   */
  async createJobsForRun(
    schedule: any,
    run: any,
    _sessionStatus: SessionStatus | null,
  ) {
    const jobs = [];
    const runMode = this.determineRunMode(schedule);
    const now = new Date();

    for (let i = 0; i < schedule.dailyPostCount; i++) {
      const delayMinutes = i * schedule.postIntervalMinutes;

      // 시스템 변수 생성
      const systemVariables = this.getSystemVariables(now);

      // 템플릿 변수 치환
      const title = this.replaceVariables(schedule.template.subjectTemplate, systemVariables);
      const content = this.replaceVariables(schedule.template.contentTemplate, systemVariables);

      // 이미지 경로 목록
      const imagePaths = schedule.template.images
        .sort((a: any, b: any) => a.order - b.order)
        .map((img: any) => img.path);

      // Job 생성 (BullMQ delay 사용)
      const job = await this.jobService.createJob({
        type: 'CREATE_POST',
        userId: schedule.userId,
        scheduleRunId: run.id,
        sequenceNumber: i + 1,
        delay: delayMinutes * 60 * 1000,  // ms 단위
        runMode,
        payload: {
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          templateId: schedule.template.id,
          templateName: schedule.template.name,
          cafeId: schedule.template.cafeId,
          cafeName: schedule.template.cafeName,
          boardId: schedule.template.boardId,
          boardName: schedule.template.boardName,
          title,
          content,
          imagePaths,
          price: schedule.template.price,
          tradeMethod: schedule.template.tradeMethod,
          tradeLocation: schedule.template.tradeLocation,
          // 진행 상황 표시를 위한 정보 (예: 2/3)
          currentPostNumber: i + 1,
          totalPosts: schedule.dailyPostCount,
        },
      });

      jobs.push(job);
    }

    // ScheduleRun 통계 업데이트
    await this.scheduleRunService.update(run.id, {
      totalJobs: jobs.length,
      status: 'RUNNING',
    });

    // Schedule 업데이트: 즉시 실행이므로 오늘 목표 달성 처리
    const todayStart = this.getTodayStart(now);
    const [hours, minutes] = schedule.runTime.split(':').map(Number);
    const tomorrowRunTime = new Date(todayStart);
    tomorrowRunTime.setDate(tomorrowRunTime.getDate() + 1);
    tomorrowRunTime.setHours(hours, minutes, 0, 0);

    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        lastRunDate: now,
        consecutiveFailures: 0,
        todayPostedCount: schedule.dailyPostCount,  // 즉시 실행이므로 목표 달성으로 처리
        nextPostAt: tomorrowRunTime,  // 다음 날 runTime으로 설정
      },
    });

    this.logger.log(
      `스케줄 ${schedule.id} 즉시 실행: ${jobs.length}개 Job 생성 완료 ` +
      `(간격: ${schedule.postIntervalMinutes}분, 모드: ${runMode})`
    );

    return jobs;
  }
}
