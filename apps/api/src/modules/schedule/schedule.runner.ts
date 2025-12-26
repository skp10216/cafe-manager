/**
 * Schedule Runner
 * 운영형 SaaS 수준 - 3조건 체크 기반 스케줄 실행
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
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);  // "09:05"
      const currentDate = now.toISOString().slice(0, 10);  // "2025-12-24"

      // 1. 실행 시간이 도래한 스케줄 찾기 (기본 조건만)
      const candidateSchedules = await this.findCandidateSchedules(currentTime, currentDate);

      if (candidateSchedules.length === 0) {
        return;
      }

      this.logger.debug(`실행 후보 스케줄 ${candidateSchedules.length}개 발견`);

      for (const schedule of candidateSchedules) {
        await this.processSchedule(schedule, currentDate);
      }
    } catch (error) {
      this.logger.error('스케줄 확인 중 오류 발생', error);
    }
  }

  /**
   * 실행 후보 스케줄 조회 (runTime 매칭 + 오늘 미실행)
   */
  private async findCandidateSchedules(currentTime: string, currentDate: string) {
    return this.prisma.schedule.findMany({
      where: {
        runTime: currentTime,
        OR: [
          { lastRunDate: null },
          { lastRunDate: { lt: new Date(currentDate) } },
        ],
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
  }

  /**
   * 개별 스케줄 처리 (3조건 체크 + Job 생성)
   */
  private async processSchedule(schedule: any, currentDate: string) {
    const scheduleId = schedule.id;
    const userId = schedule.userId;

    // 3조건 체크
    const executability = this.checkExecutability(schedule);

    // 조건 미충족 시 BLOCKED/SKIPPED로 기록
    if (!executability.canExecute) {
      await this.handleBlockedSchedule(schedule, currentDate, executability);
      return;
    }

    // 중복 실행 방지 (Idempotency)
    const existingRun = await this.scheduleRunService.findByScheduleAndDate(
      scheduleId,
      new Date(currentDate),
    );

    if (existingRun && existingRun.status !== 'BLOCKED' && existingRun.status !== 'SKIPPED') {
      this.logger.debug(`스케줄 ${scheduleId}: 오늘 이미 실행됨 (runId=${existingRun.id})`);
      return;
    }

    // ScheduleRun 생성
    const run = await this.scheduleRunService.createOrUpdate({
      scheduleId,
      userId,
      runDate: new Date(currentDate),
      status: 'QUEUED',
      blockCode: null,
      blockReason: null,
    });

    if (!run) {
      this.logger.warn(`스케줄 ${scheduleId}: ScheduleRun 생성 실패`);
      return;
    }

    // N개 Job 생성 (간격 적용)
    await this.createJobsForRun(schedule, run, executability.sessionStatus);
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
    currentDate: string,
    executability: ExecutabilityCheck,
  ) {
    const { blockCode, blockMessage } = executability;

    // 차단 상태 결정 (사용자 비활성화 = SKIPPED, 그 외 = BLOCKED)
    const status: RunStatus = blockCode === 'USER_DISABLED' ? 'SKIPPED' : 'BLOCKED';

    this.logger.debug(
      `스케줄 ${schedule.id} ${status}: ${blockMessage} (code=${blockCode})`
    );

    // ScheduleRun 생성 (차단/스킵 기록)
    await this.scheduleRunService.createOrUpdate({
      scheduleId: schedule.id,
      userId: schedule.userId,
      runDate: new Date(currentDate),
      status,
      blockCode,
      blockReason: blockMessage,
    });

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
    const autoSuspendThreshold = 5; // TODO: Policy에서 가져오기

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
   * 스케줄에 대해 N개 Job 생성 (간격 적용)
   * public으로 노출하여 즉시 실행(runNow)에서도 호출 가능
   */
  async createJobsForRun(
    schedule: any,
    run: any,
    sessionStatus: SessionStatus | null,
  ) {
    const jobs = [];
    const runMode = this.determineRunMode(schedule);

    for (let i = 0; i < schedule.dailyPostCount; i++) {
      const delayMinutes = i * schedule.postIntervalMinutes;

      // 시스템 변수 생성
      const systemVariables = this.getSystemVariables();

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
        },
      });

      jobs.push(job);
    }

    // ScheduleRun 통계 업데이트
    await this.scheduleRunService.update(run.id, {
      totalJobs: jobs.length,
      status: 'RUNNING',
    });

    // Schedule lastRunDate 업데이트 + 연속 실패 카운트 리셋
    await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        lastRunDate: new Date(),
        consecutiveFailures: 0,
      },
    });

    this.logger.log(
      `스케줄 ${schedule.id} 실행: ${jobs.length}개 Job 생성 완료 ` +
      `(간격: ${schedule.postIntervalMinutes}분, 모드: ${runMode})`
    );
  }

  /**
   * 실행 모드 결정 (연속 실패 시 디버그 모드)
   */
  private determineRunMode(schedule: any): 'HEADLESS' | 'DEBUG' {
    const debugThreshold = 3; // TODO: Policy에서 가져오기
    
    if (schedule.consecutiveFailures >= debugThreshold) {
      return 'DEBUG';
    }
    
    return 'HEADLESS';
  }

  /**
   * 시스템 변수 생성 (날짜, 시간 등)
   */
  private getSystemVariables(): Record<string, string> {
    const now = new Date();
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
}
