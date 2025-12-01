/**
 * Job 서비스
 * 작업 비즈니스 로직
 */

import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JobProducer } from './job.producer';
import { JobQueryDto } from './dto/job-query.dto';
import {
    PaginatedResponse,
    createPaginationMeta,
} from '@/common/dto/pagination.dto';
import { Job, JobType, JobStatus } from '@prisma/client';
// import { DEFAULT_JOB_MAX_ATTEMPTS } from '@cafe-manager/core';
import { Prisma } from '@prisma/client';

interface CreateJobInput {
    type: JobType;
    userId: string;
    payload: Record<string, unknown>;
}

const DEFAULT_JOB_MAX_ATTEMPTS = 3; // core에 정의한 값과 맞춰주면 됨

@Injectable()
export class JobService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jobProducer: JobProducer
    ) { }

    /**
     * 작업 목록 조회 (페이지네이션 + 필터)
     */
    async findAll(
        userId: string,
        query: JobQueryDto
    ): Promise<PaginatedResponse<Job>> {
        const { page = 1, limit = 20, type, status } = query;
        const skip = (page - 1) * limit;

        const where = {
            userId,
            ...(type && { type }),
            ...(status && { status }),
        };

        const [data, total] = await Promise.all([
            this.prisma.job.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.job.count({ where }),
        ]);

        return {
            data,
            meta: createPaginationMeta(page, limit, total),
        };
    }

    /**
     * 작업 상세 조회
     */
    async findOne(id: string, userId: string) {
        const job = await this.prisma.job.findUnique({
            where: { id },
        });

        if (!job) {
            throw new NotFoundException('작업을 찾을 수 없습니다');
        }

        if (job.userId !== userId) {
            throw new ForbiddenException('접근 권한이 없습니다');
        }

        return job;
    }

    /**
     * 작업 로그 조회
     */
    async findLogs(jobId: string, userId: string) {
        // 작업 소유권 확인
        await this.findOne(jobId, userId);

        return this.prisma.jobLog.findMany({
            where: { jobId },
            orderBy: { createdAt: 'asc' },
        });
    }

    /**
     * 최근 작업 요약 (대시보드용)
     */
    async getRecentSummary(userId: string) {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const [todayJobs, recentJobs, statusCounts] = await Promise.all([
            // 오늘 생성된 작업 수
            this.prisma.job.count({
                where: {
                    userId,
                    createdAt: { gte: todayStart },
                },
            }),
            // 최근 10개 작업
            this.prisma.job.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            // 상태별 카운트
            this.prisma.job.groupBy({
                by: ['status'],
                where: { userId },
                _count: { id: true },
            }),
        ]);

        const statusMap = statusCounts.reduce(
            (acc, item) => {
                acc[item.status] = item._count.id;
                return acc;
            },
            {} as Record<string, number>
        );

        return {
            todayCount: todayJobs,
            recentJobs,
            byStatus: {
                pending: statusMap.PENDING || 0,
                processing: statusMap.PROCESSING || 0,
                completed: statusMap.COMPLETED || 0,
                failed: statusMap.FAILED || 0,
            },
        };
    }

    /**
     * 새 작업 생성 및 큐에 추가
     */
    async createJob(input: CreateJobInput): Promise<Job> {
        // DB에 작업 레코드 생성
        const job = await this.prisma.job.create({
            data: {
                type: input.type,
                userId: input.userId,
                payload: input.payload as Prisma.InputJsonValue,
                status: 'PENDING',
                maxAttempts: DEFAULT_JOB_MAX_ATTEMPTS,
            },
        });

        // BullMQ 큐에 작업 추가
        await this.jobProducer.addJob(job.id, input.type, input.payload);

        return job;
    }

    /**
     * 작업 상태 업데이트 (Worker에서 호출)
     */
    async updateStatus(
        id: string,
        status: JobStatus,
        options?: {
            errorMessage?: string;
            startedAt?: Date;
            finishedAt?: Date;
        }
    ) {
        return this.prisma.job.update({
            where: { id },
            data: {
                status,
                errorMessage: options?.errorMessage,
                startedAt: options?.startedAt,
                finishedAt: options?.finishedAt,
                attempts: status === 'PROCESSING' ? { increment: 1 } : undefined,
            },
        });
    }

    /**
     * 작업 로그 추가 (Worker에서 호출)
     */
    async addLog(
        jobId: string,
        level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
        message: string,
        meta?: Record<string, unknown>
    ) {
        return this.prisma.jobLog.create({
            data: {
                jobId,
                level,
                message,
                // meta가 있으면 Prisma에서 허용하는 JSON 타입으로 캐스팅,
                // 없으면 DbNull로 저장
                meta: meta
                    ? (meta as Prisma.InputJsonValue)
                    : Prisma.DbNull,
            },
        });
    }
}

