/**
 * AuditLog 서비스
 * 감사 로그 생성 및 조회
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Prisma, ActorType, EntityType, AuditAction } from '@prisma/client';

/** 감사 로그 생성 입력 */
export interface CreateAuditLogInput {
  actorId?: string;
  actorType: ActorType;
  actorEmail?: string;
  targetUserId?: string;
  targetEmail?: string;
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  reason?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/** 감사 로그 조회 필터 */
export interface AuditLogQueryDto {
  page?: number;
  limit?: number;
  actorId?: string;
  targetUserId?: string;
  entityType?: EntityType;
  entityId?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 감사 로그 생성
   */
  async log(input: CreateAuditLogInput) {
    try {
      const log = await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          actorType: input.actorType,
          actorEmail: input.actorEmail,
          targetUserId: input.targetUserId,
          targetEmail: input.targetEmail,
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          reason: input.reason,
          previousValue: input.previousValue as Prisma.InputJsonValue,
          newValue: input.newValue as Prisma.InputJsonValue,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });

      this.logger.debug(
        `감사 로그 생성: ${input.action} on ${input.entityType}:${input.entityId}`
      );

      return log;
    } catch (error) {
      // 감사 로그 생성 실패는 비즈니스 로직에 영향을 주지 않도록 경고만 남김
      this.logger.error(
        `감사 로그 생성 실패: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * 스케줄 승인 로그
   */
  async logScheduleApprove(params: {
    adminId: string;
    adminEmail?: string;
    scheduleId: string;
    userId: string;
    userEmail?: string;
    reason?: string;
    ipAddress?: string;
  }) {
    return this.log({
      actorId: params.adminId,
      actorType: 'ADMIN',
      actorEmail: params.adminEmail,
      targetUserId: params.userId,
      targetEmail: params.userEmail,
      entityType: 'SCHEDULE',
      entityId: params.scheduleId,
      action: 'SCHEDULE_APPROVE',
      reason: params.reason,
      ipAddress: params.ipAddress,
      newValue: { adminStatus: 'APPROVED' },
    });
  }

  /**
   * 스케줄 중지 로그
   */
  async logScheduleSuspend(params: {
    adminId: string;
    adminEmail?: string;
    scheduleId: string;
    userId: string;
    userEmail?: string;
    reason: string;
    ipAddress?: string;
  }) {
    return this.log({
      actorId: params.adminId,
      actorType: 'ADMIN',
      actorEmail: params.adminEmail,
      targetUserId: params.userId,
      targetEmail: params.userEmail,
      entityType: 'SCHEDULE',
      entityId: params.scheduleId,
      action: 'SCHEDULE_SUSPEND',
      reason: params.reason,
      ipAddress: params.ipAddress,
      newValue: { adminStatus: 'SUSPENDED' },
    });
  }

  /**
   * 스케줄 차단 로그
   */
  async logScheduleBan(params: {
    adminId: string;
    adminEmail?: string;
    scheduleId: string;
    userId: string;
    userEmail?: string;
    reason: string;
    ipAddress?: string;
  }) {
    return this.log({
      actorId: params.adminId,
      actorType: 'ADMIN',
      actorEmail: params.adminEmail,
      targetUserId: params.userId,
      targetEmail: params.userEmail,
      entityType: 'SCHEDULE',
      entityId: params.scheduleId,
      action: 'SCHEDULE_BAN',
      reason: params.reason,
      ipAddress: params.ipAddress,
      newValue: { adminStatus: 'BANNED' },
    });
  }

  /**
   * 스케줄 토글 로그
   */
  async logScheduleToggle(params: {
    userId: string;
    userEmail?: string;
    scheduleId: string;
    previousEnabled: boolean;
    newEnabled: boolean;
    ipAddress?: string;
  }) {
    return this.log({
      actorId: params.userId,
      actorType: 'USER',
      actorEmail: params.userEmail,
      targetUserId: params.userId,
      entityType: 'SCHEDULE',
      entityId: params.scheduleId,
      action: 'SCHEDULE_TOGGLE',
      previousValue: { userEnabled: params.previousEnabled },
      newValue: { userEnabled: params.newEnabled },
      ipAddress: params.ipAddress,
    });
  }

  /**
   * 감사 로그 목록 조회 (Admin용)
   */
  async findAll(query: AuditLogQueryDto) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.actorId) {
      where.actorId = query.actorId;
    }
    if (query.targetUserId) {
      where.targetUserId = query.targetUserId;
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.entityId) {
      where.entityId = query.entityId;
    }
    if (query.action) {
      where.action = query.action;
    }

    // 날짜 범위
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const endDate = new Date(query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
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
   * 특정 엔티티의 감사 로그 조회
   */
  async findByEntity(entityType: EntityType, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * 특정 사용자의 감사 로그 조회
   */
  async findByUser(userId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: userId },
          { targetUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}




