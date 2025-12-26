/**
 * Incident Service
 * 이상 징후 감지 및 관리
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { AuditLogService } from '@/modules/audit-log/audit-log.service';
import { QUEUE_NAMES } from '@/common/constants';
import { IncidentType, IncidentSeverity, IncidentStatus, AuditAction, EntityType } from '@prisma/client';

// 이상 징후 감지 임계값
const THRESHOLDS = {
  QUEUE_BACKLOG: {
    WARNING: 100,    // 100개 이상 대기 → MEDIUM
    CRITICAL: 500,   // 500개 이상 대기 → HIGH
  },
  HIGH_FAILURE_RATE: {
    WARNING: 10,     // 10% 이상 실패율 → MEDIUM
    CRITICAL: 30,    // 30% 이상 실패율 → HIGH
  },
};

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * 이상 징후 감지 (StatsSnapshot 수집 시 호출)
   */
  async detectIncidents(queueName: string, stats: {
    waiting: number;
    failed: number;
    completed: number;
    jobsPerMin: number | null;
  }): Promise<void> {
    // 1. QUEUE_BACKLOG 감지
    await this.detectQueueBacklog(queueName, stats.waiting);

    // 2. HIGH_FAILURE_RATE 감지
    await this.detectHighFailureRate(queueName, stats.failed, stats.completed);
  }

  /**
   * 대기열 적체 감지
   */
  private async detectQueueBacklog(queueName: string, waiting: number): Promise<void> {
    const type = IncidentType.QUEUE_BACKLOG;

    // 현재 활성 Incident 확인
    const existingIncident = await this.prisma.incident.findFirst({
      where: {
        type,
        queueName,
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
      },
    });

    // 임계값 판정
    let severity: IncidentSeverity | null = null;
    if (waiting >= THRESHOLDS.QUEUE_BACKLOG.CRITICAL) {
      severity = IncidentSeverity.HIGH;
    } else if (waiting >= THRESHOLDS.QUEUE_BACKLOG.WARNING) {
      severity = IncidentSeverity.MEDIUM;
    }

    if (severity) {
      // 새 Incident 생성 또는 기존 업데이트
      if (!existingIncident) {
        await this.createIncident({
          type,
          severity,
          queueName,
          affectedJobs: waiting,
          title: `대기열 적체: ${queueName}`,
          description: `${waiting}개의 작업이 대기 중입니다.`,
          recommendedAction: '워커 수를 늘리거나, 일시적으로 스케줄을 중지하세요.',
        });
      } else if (existingIncident.severity !== severity) {
        // 심각도 변경 시 업데이트
        await this.prisma.incident.update({
          where: { id: existingIncident.id },
          data: { severity, affectedJobs: waiting },
        });
      }
    } else if (existingIncident && waiting < THRESHOLDS.QUEUE_BACKLOG.WARNING / 2) {
      // 임계값 절반 이하로 떨어지면 자동 해결
      await this.autoResolveIncident(existingIncident.id, '대기열이 정상 수준으로 돌아왔습니다.');
    }
  }

  /**
   * 높은 실패율 감지
   */
  private async detectHighFailureRate(
    queueName: string,
    failed: number,
    completed: number
  ): Promise<void> {
    const type = IncidentType.HIGH_FAILURE_RATE;

    // 최근 스냅샷과 비교하여 실패율 계산 (최근 1시간)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldSnapshot = await this.prisma.queueStatsSnapshot.findFirst({
      where: {
        queueName,
        timestamp: { lte: oneHourAgo },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!oldSnapshot) return;

    const recentFailed = Math.max(0, failed - oldSnapshot.failed);
    const recentCompleted = Math.max(0, completed - oldSnapshot.completed);
    const total = recentFailed + recentCompleted;

    if (total < 10) return; // 샘플이 너무 적으면 스킵

    const failureRate = (recentFailed / total) * 100;

    // 현재 활성 Incident 확인
    const existingIncident = await this.prisma.incident.findFirst({
      where: {
        type,
        queueName,
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
      },
    });

    // 임계값 판정
    let severity: IncidentSeverity | null = null;
    if (failureRate >= THRESHOLDS.HIGH_FAILURE_RATE.CRITICAL) {
      severity = IncidentSeverity.HIGH;
    } else if (failureRate >= THRESHOLDS.HIGH_FAILURE_RATE.WARNING) {
      severity = IncidentSeverity.MEDIUM;
    }

    if (severity) {
      if (!existingIncident) {
        await this.createIncident({
          type,
          severity,
          queueName,
          affectedJobs: recentFailed,
          title: `높은 실패율: ${queueName}`,
          description: `최근 1시간 실패율이 ${failureRate.toFixed(1)}%입니다. (${recentFailed}/${total})`,
          recommendedAction: '실패 로그를 확인하고, 원인을 파악하세요.',
        });
      } else if (existingIncident.severity !== severity) {
        await this.prisma.incident.update({
          where: { id: existingIncident.id },
          data: {
            severity,
            affectedJobs: recentFailed,
            description: `최근 1시간 실패율이 ${failureRate.toFixed(1)}%입니다. (${recentFailed}/${total})`,
          },
        });
      }
    } else if (existingIncident && failureRate < THRESHOLDS.HIGH_FAILURE_RATE.WARNING / 2) {
      await this.autoResolveIncident(existingIncident.id, '실패율이 정상 수준으로 돌아왔습니다.');
    }
  }

  /**
   * Incident 생성
   */
  private async createIncident(data: {
    type: IncidentType;
    severity: IncidentSeverity;
    queueName: string;
    affectedJobs: number;
    title: string;
    description: string;
    recommendedAction: string;
  }): Promise<void> {
    try {
      await this.prisma.incident.create({
        data: {
          ...data,
          status: IncidentStatus.ACTIVE,
        },
      });
      this.logger.warn(`🚨 Incident 생성: ${data.title}`);
    } catch (error) {
      // unique constraint 충돌 시 무시 (중복 생성 방지)
      if ((error as { code?: string }).code === 'P2002') {
        this.logger.debug('중복 Incident 생성 시도 무시');
      } else {
        throw error;
      }
    }
  }

  /**
   * Incident 자동 해결
   */
  private async autoResolveIncident(id: string, reason: string): Promise<void> {
    await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: 'SYSTEM',
      },
    });
    this.logger.log(`✅ Incident 자동 해결: ${id} - ${reason}`);
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Incident 목록 조회
   */
  async getIncidents(options: {
    status?: IncidentStatus;
    type?: IncidentType;
    limit?: number;
  } = {}) {
    const { status, type, limit = 50 } = options;

    return this.prisma.incident.findMany({
      where: {
        ...(status && { status }),
        ...(type && { type }),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Active Incidents 조회 (Overview용)
   */
  async getActiveIncidents() {
    return this.prisma.incident.findMany({
      where: {
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
      },
      orderBy: [
        { severity: 'desc' },  // CRITICAL > HIGH > MEDIUM > LOW
        { startedAt: 'desc' },
      ],
    });
  }

  /**
   * Incident 상세 조회
   */
  async getIncidentById(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident를 찾을 수 없습니다: ${id}`);
    }

    return incident;
  }

  /**
   * Incident 확인 (Acknowledge)
   */
  async acknowledgeIncident(id: string, adminId: string) {
    const incident = await this.getIncidentById(id);

    if (incident.status !== IncidentStatus.ACTIVE) {
      throw new Error('활성 상태의 Incident만 확인 처리할 수 있습니다.');
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: { status: IncidentStatus.ACKNOWLEDGED },
    });

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.INCIDENT,
      entityId: id,
      action: AuditAction.INCIDENT_ACKNOWLEDGE,
    });

    this.logger.log(`Incident 확인: ${id} by ${adminId}`);
    return updated;
  }

  /**
   * Incident 해결 (Resolve)
   */
  async resolveIncident(id: string, adminId: string, reason?: string) {
    const incident = await this.getIncidentById(id);

    if (incident.status === IncidentStatus.RESOLVED) {
      throw new Error('이미 해결된 Incident입니다.');
    }

    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedBy: adminId,
      },
    });

    // AuditLog 기록
    await this.auditLogService.log({
      actorId: adminId,
      actorType: 'ADMIN',
      entityType: EntityType.INCIDENT,
      entityId: id,
      action: AuditAction.INCIDENT_RESOLVE,
      reason,
    });

    this.logger.log(`Incident 해결: ${id} by ${adminId}`);
    return updated;
  }
}

