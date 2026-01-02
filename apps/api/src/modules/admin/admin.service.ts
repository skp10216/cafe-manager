/**
 * Admin 서비스
 * 관리자 운영 콘솔 비즈니스 로직
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AdminStatus, SessionStatus, Prisma } from '@prisma/client';

/** 스케줄 심사 입력 */
export interface ReviewScheduleInput {
  adminId: string;
  adminEmail?: string;
  scheduleId: string;
  action: 'APPROVE' | 'SUSPEND' | 'BAN' | 'UNSUSPEND';
  reason?: string;
  ipAddress?: string;
}

/** 스케줄 조회 필터 */
export interface AdminScheduleQueryDto {
  page?: number;
  limit?: number;
  adminStatus?: AdminStatus;
  userId?: string;
  search?: string;
}

/** 세션 모니터 필터 */
export interface AdminSessionQueryDto {
  page?: number;
  limit?: number;
  status?: SessionStatus;
  userId?: string;
}

/** 대시보드 통계 */
export interface AdminDashboardStats {
  users: {
    total: number;
    activeToday: number;
  };
  schedules: {
    total: number;
    needsReview: number;
    suspended: number;
    banned: number;
  };
  sessions: {
    total: number;
    healthy: number;
    expired: number;
    challengeRequired: number;
    error: number;
  };
  jobs: {
    todayTotal: number;
    todayCompleted: number;
    todayFailed: number;
  };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ============================================
  // 대시보드
  // ============================================

  /**
   * 관리자 대시보드 통계
   */
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      usersTotal,
      usersActiveToday,
      schedulesTotal,
      schedulesNeedsReview,
      schedulesSuspended,
      schedulesBanned,
      sessionsTotal,
      sessionsHealthy,
      sessionsExpired,
      sessionsChallengeRequired,
      sessionsError,
      jobsTodayTotal,
      jobsTodayCompleted,
      jobsTodayFailed,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.job.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: today } },
      }).then((r) => r.length),
      this.prisma.schedule.count(),
      this.prisma.schedule.count({ where: { adminStatus: 'NEEDS_REVIEW' } }),
      this.prisma.schedule.count({ where: { adminStatus: 'SUSPENDED' } }),
      this.prisma.schedule.count({ where: { adminStatus: 'BANNED' } }),
      this.prisma.naverSession.count(),
      this.prisma.naverSession.count({ where: { status: 'HEALTHY' } }),
      this.prisma.naverSession.count({ where: { status: 'EXPIRED' } }),
      this.prisma.naverSession.count({ where: { status: 'CHALLENGE_REQUIRED' } }),
      this.prisma.naverSession.count({ where: { status: 'ERROR' } }),
      this.prisma.job.count({ where: { createdAt: { gte: today } } }),
      this.prisma.job.count({ where: { createdAt: { gte: today }, status: 'COMPLETED' } }),
      this.prisma.job.count({ where: { createdAt: { gte: today }, status: 'FAILED' } }),
    ]);

    return {
      users: {
        total: usersTotal,
        activeToday: usersActiveToday,
      },
      schedules: {
        total: schedulesTotal,
        needsReview: schedulesNeedsReview,
        suspended: schedulesSuspended,
        banned: schedulesBanned,
      },
      sessions: {
        total: sessionsTotal,
        healthy: sessionsHealthy,
        expired: sessionsExpired,
        challengeRequired: sessionsChallengeRequired,
        error: sessionsError,
      },
      jobs: {
        todayTotal: jobsTodayTotal,
        todayCompleted: jobsTodayCompleted,
        todayFailed: jobsTodayFailed,
      },
    };
  }

  // ============================================
  // 스케줄 승인 관리
  // ============================================

  /**
   * 스케줄 목록 조회 (Admin)
   */
  async getSchedules(query: AdminScheduleQueryDto) {
    const { page = 1, limit = 20, adminStatus, userId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ScheduleWhereInput = {};

    if (adminStatus) {
      where.adminStatus = adminStatus;
    }
    if (userId) {
      where.userId = userId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              cafeName: true,
              boardName: true,
            },
          },
        },
        orderBy: [
          { adminStatus: 'asc' },  // NEEDS_REVIEW 먼저
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.schedule.count({ where }),
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
   * 스케줄 심사 (승인/중지/차단/해제)
   */
  async reviewSchedule(input: ReviewScheduleInput) {
    const { adminId, adminEmail, scheduleId, action, reason, ipAddress } = input;

    // 스케줄 조회
    const schedule = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('스케줄을 찾을 수 없습니다');
    }

    // 상태 변경
    let newAdminStatus: AdminStatus;
    let auditAction: 'SCHEDULE_APPROVE' | 'SCHEDULE_SUSPEND' | 'SCHEDULE_BAN' | 'SCHEDULE_UNSUSPEND';

    switch (action) {
      case 'APPROVE':
        newAdminStatus = 'APPROVED';
        auditAction = 'SCHEDULE_APPROVE';
        break;
      case 'SUSPEND':
        if (!reason) {
          throw new BadRequestException('중지 사유를 입력해주세요');
        }
        newAdminStatus = 'SUSPENDED';
        auditAction = 'SCHEDULE_SUSPEND';
        break;
      case 'BAN':
        if (!reason) {
          throw new BadRequestException('차단 사유를 입력해주세요');
        }
        newAdminStatus = 'BANNED';
        auditAction = 'SCHEDULE_BAN';
        break;
      case 'UNSUSPEND':
        newAdminStatus = 'APPROVED';
        auditAction = 'SCHEDULE_UNSUSPEND';
        break;
      default:
        throw new BadRequestException('유효하지 않은 액션입니다');
    }

    // 업데이트
    const updated = await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        adminStatus: newAdminStatus,
        adminReason: action === 'APPROVE' || action === 'UNSUSPEND' ? null : reason,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        suspendedAt: action === 'SUSPEND' || action === 'BAN' ? new Date() : null,
        consecutiveFailures: action === 'UNSUSPEND' ? 0 : undefined,  // 해제 시 연속 실패 리셋
      },
    });

    // 감사 로그 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      actorEmail: adminEmail,
      targetUserId: schedule.userId,
      targetEmail: schedule.user.email,
      entityType: 'SCHEDULE',
      entityId: scheduleId,
      action: auditAction,
      reason,
      previousValue: { adminStatus: schedule.adminStatus },
      newValue: { adminStatus: newAdminStatus },
      ipAddress,
    });

    this.logger.log(
      `스케줄 ${action}: scheduleId=${scheduleId}, by=${adminEmail}, reason=${reason || 'N/A'}`
    );

    return updated;
  }

  /**
   * 일괄 승인
   */
  async bulkApprove(adminId: string, adminEmail: string, scheduleIds: string[]) {
    const results = [];

    for (const scheduleId of scheduleIds) {
      try {
        const result = await this.reviewSchedule({
          adminId,
          adminEmail,
          scheduleId,
          action: 'APPROVE',
        });
        results.push({ scheduleId, success: true, result });
      } catch (error) {
        results.push({
          scheduleId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  // ============================================
  // 세션 모니터링
  // ============================================

  /**
   * 세션 목록 조회 (Admin)
   */
  async getSessions(query: AdminSessionQueryDto) {
    const { page = 1, limit = 20, status, userId } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.NaverSessionWhereInput = {};

    if (status) {
      where.status = status;
    }
    if (userId) {
      where.naverAccount = { userId };
    }

    const [data, total] = await Promise.all([
      this.prisma.naverSession.findMany({
        where,
        include: {
          naverAccount: {
            select: {
              id: true,
              loginId: true,
              displayName: true,
              status: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [
          { status: 'asc' },
          { lastVerifiedAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.naverSession.count({ where }),
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
   * 세션 상태별 집계
   */
  async getSessionStatusCounts() {
    const counts = await this.prisma.naverSession.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const result: Record<string, number> = {
      PENDING: 0,
      HEALTHY: 0,
      EXPIRING: 0,
      EXPIRED: 0,
      CHALLENGE_REQUIRED: 0,
      ERROR: 0,
    };

    counts.forEach((c) => {
      result[c.status] = c._count.id;
    });

    return result;
  }

  // ============================================
  // 사용자 관리
  // ============================================

  /**
   * 사용자 목록 조회 (Admin)
   */
  async getUsers(query: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          planType: true,
          expireAt: true,
          createdAt: true,
          _count: {
            select: {
              schedules: true,
              naverAccounts: true,
              jobs: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
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
   * 사용자 상세 조회 (Admin)
   */
  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        schedules: {
          include: {
            template: {
              select: {
                id: true,
                name: true,
                cafeName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        naverAccounts: {
          include: {
            sessions: {
              orderBy: { lastVerifiedAt: 'desc' },
              take: 1,
            },
          },
        },
        _count: {
          select: {
            jobs: true,
            managedPosts: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    return user;
  }
}




