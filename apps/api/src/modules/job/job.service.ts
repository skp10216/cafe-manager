/**
 * Job 서비스
 * 작업 비즈니스 로직
 */

import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JobProducer } from './job.producer';
import { JobQueryDto } from './dto/job-query.dto';
import { DeleteFilterType, DeleteJobsResult } from './dto/delete-jobs.dto';
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
    scheduleRunId?: string;
    sequenceNumber?: number;
    delay?: number;
    runMode?: 'HEADLESS' | 'DEBUG';
}

const DEFAULT_JOB_MAX_ATTEMPTS = 3; // core에 정의한 값과 맞춰주면 됨

@Injectable()
export class JobService {
    private readonly logger = new Logger(JobService.name);

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
        const {
            page = 1,
            limit = 20,
            type,
            status,
            dateFrom,
            dateTo,
            scheduleId,
            scheduleName,
        } = query;
        const skip = (page - 1) * limit;

        const where: any = {
            userId,
            ...(type && { type }),
            ...(status && { status }),
        };

        // 날짜 범위 필터
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = new Date(dateFrom);
            }
            if (dateTo) {
                // 종료일의 23:59:59.999까지 포함
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                where.createdAt.lte = endDate;
            }
        }

        // 스케줄 필터는 JSON payload에서 필터링해야 하므로 post-filter 필요
        const needsPostFilter = scheduleId || scheduleName;

        const [allData, total] = await Promise.all([
            this.prisma.job.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: needsPostFilter ? 0 : skip,
                take: needsPostFilter ? undefined : limit,
            }),
            needsPostFilter ? 0 : this.prisma.job.count({ where }),
        ]);

        // Post-filter: 스케줄 필터 적용
        let data = allData;
        if (needsPostFilter) {
            data = allData.filter((job) => {
                const payload = job.payload as any;
                if (scheduleId && payload?.scheduleId !== scheduleId) {
                    return false;
                }
                if (
                    scheduleName &&
                    !payload?.scheduleName
                        ?.toLowerCase()
                        .includes(scheduleName.toLowerCase())
                ) {
                    return false;
                }
                return true;
            });

            // 필터링 후 페이지네이션 적용
            const filteredTotal = data.length;
            data = data.slice(skip, skip + limit);

            return {
                data,
                meta: createPaginationMeta(page, limit, filteredTotal),
            };
        }

        // 실행 순서 정보 추가
        const enrichedData = await this.enrichWithExecutionOrder(data);

        return {
            data: enrichedData,
            meta: createPaginationMeta(page, limit, total),
        };
    }

    /**
     * 작업에 실행 순서 정보 추가
     */
    private async enrichWithExecutionOrder(jobs: Job[]): Promise<any[]> {
        // CREATE_POST 작업에서 고유한 scheduleId 추출
        const scheduleIds = new Set<string>();
        jobs.forEach((job) => {
            const payload = job.payload as any;
            if (job.type === 'CREATE_POST' && payload?.scheduleId) {
                scheduleIds.add(payload.scheduleId);
            }
        });

        if (scheduleIds.size === 0) {
            // 스케줄 작업이 없으면 그대로 반환
            return jobs.map((job) => ({
                ...job,
                executionOrder: null,
                totalExecutions: null,
            }));
        }

        // 배치 쿼리: 해당 스케줄들의 모든 CREATE_POST 작업 조회
        const scheduleJobs = await this.prisma.job.findMany({
            where: {
                type: 'CREATE_POST',
            },
            select: {
                id: true,
                createdAt: true,
                payload: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        // scheduleId별로 그룹화
        const scheduleJobMap = new Map<
            string,
            Array<{ id: string; createdAt: Date }>
        >();
        scheduleJobs.forEach((job) => {
            const payload = job.payload as any;
            const scheduleId = payload?.scheduleId;
            if (scheduleId && scheduleIds.has(scheduleId)) {
                if (!scheduleJobMap.has(scheduleId)) {
                    scheduleJobMap.set(scheduleId, []);
                }
                scheduleJobMap.get(scheduleId)!.push({
                    id: job.id,
                    createdAt: job.createdAt,
                });
            }
        });

        // 각 작업에 실행 순서 정보 추가
        return jobs.map((job) => {
            const payload = job.payload as any;
            const scheduleId = payload?.scheduleId;

            if (job.type === 'CREATE_POST' && scheduleId) {
                const scheduleJobsList = scheduleJobMap.get(scheduleId) || [];
                const totalExecutions = scheduleJobsList.length;
                const executionOrder =
                    scheduleJobsList.findIndex((sj) => sj.id === job.id) + 1;

                return {
                    ...job,
                    executionOrder: executionOrder > 0 ? executionOrder : null,
                    totalExecutions,
                };
            }

            return {
                ...job,
                executionOrder: null,
                totalExecutions: null,
            };
        });
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
        this.logger.log(
            `createJob 시작: type=${input.type}, userId=${input.userId}` +
            (input.scheduleRunId ? `, scheduleRunId=${input.scheduleRunId}` : '')
        );

        // 1) DB에 작업 레코드 생성
        const job = await this.prisma.job.create({
            data: {
                type: input.type,
                userId: input.userId,
                payload: input.payload as Prisma.InputJsonValue,
                status: 'PENDING',
                maxAttempts: DEFAULT_JOB_MAX_ATTEMPTS,
                scheduleRunId: input.scheduleRunId,
                sequenceNumber: input.sequenceNumber,
                runMode: input.runMode ?? 'HEADLESS',
            },
        });

        this.logger.log(
            `Job 레코드 생성 완료: jobId=${job.id}, type=${job.type}` +
            (job.sequenceNumber ? `, seq=${job.sequenceNumber}` : '')
        );

        // 2) BullMQ 큐에 작업 추가 (delay 포함)
        try {
            await this.jobProducer.addJob(
                job.id,
                input.type,
                input.payload,
                input.delay  // delay 추가
            );
            this.logger.log(
                `BullMQ 큐 추가 성공: jobId=${job.id}, type=${job.type}` +
                (input.delay ? `, delay=${input.delay}ms` : '')
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);

            this.logger.error(
                `BullMQ 큐 추가 실패: jobId=${job.id}, type=${job.type}, error=${message}`,
                error instanceof Error ? error.stack : undefined
            );

            // 큐 추가 실패 시 Job 상태를 FAILED로 마킹하여 UI에서 바로 확인 가능하게 함
            await this.prisma.job.update({
                where: { id: job.id },
                data: {
                    status: 'FAILED',
                    errorMessage: `Queue enqueue failed: ${message}`,
                },
            });

            // 예외를 다시 던져서 API 응답이 실패하도록 함
            throw error;
        }

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

    // ========================================
    // 삭제 관련 메서드
    // ========================================

    /**
     * 선택한 작업들 삭제
     * @param userId 사용자 ID
     * @param jobIds 삭제할 Job ID 배열
     */
    async deleteByIds(userId: string, jobIds: string[]): Promise<DeleteJobsResult> {
        if (jobIds.length === 0) {
            return { deletedCount: 0, message: '삭제할 작업이 없습니다' };
        }

        // 트랜잭션으로 Job과 관련 JobLog 함께 삭제
        const result = await this.prisma.$transaction(async (tx) => {
            // 1. 해당 사용자의 Job인지 확인 후 삭제할 ID 필터링
            const jobsToDelete = await tx.job.findMany({
                where: {
                    id: { in: jobIds },
                    userId,
                },
                select: { id: true },
            });

            const validIds = jobsToDelete.map(j => j.id);

            if (validIds.length === 0) {
                return { deletedCount: 0 };
            }

            // 2. 관련 JobLog 먼저 삭제
            await tx.jobLog.deleteMany({
                where: { jobId: { in: validIds } },
            });

            // 3. Job 삭제
            const deleteResult = await tx.job.deleteMany({
                where: { id: { in: validIds } },
            });

            return { deletedCount: deleteResult.count };
        });

        this.logger.log(`사용자 ${userId}의 작업 ${result.deletedCount}개 삭제 완료`);

        return {
            deletedCount: result.deletedCount,
            message: `${result.deletedCount}개의 작업이 삭제되었습니다`,
        };
    }

    /**
     * 필터 기반 작업 삭제
     * @param userId 사용자 ID
     * @param filter 삭제 필터 타입
     * @param beforeDate 기준 날짜 (OLD 필터용)
     */
    async deleteByFilter(
        userId: string,
        filter: DeleteFilterType,
        beforeDate?: string
    ): Promise<DeleteJobsResult> {
        const where: Prisma.JobWhereInput = { userId };

        switch (filter) {
            case DeleteFilterType.ALL:
                // 모든 작업 삭제 (진행 중인 작업 제외)
                where.status = { notIn: ['PENDING', 'PROCESSING'] };
                break;

            case DeleteFilterType.COMPLETED:
                where.status = 'COMPLETED';
                break;

            case DeleteFilterType.FAILED:
                where.status = 'FAILED';
                break;

            case DeleteFilterType.OLD:
                // 기본: 30일 이전 작업
                const cutoffDate = beforeDate
                    ? new Date(beforeDate)
                    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                where.createdAt = { lt: cutoffDate };
                where.status = { notIn: ['PENDING', 'PROCESSING'] };
                break;

            default:
                return { deletedCount: 0, message: '유효하지 않은 필터입니다' };
        }

        // 트랜잭션으로 삭제
        const result = await this.prisma.$transaction(async (tx) => {
            // 1. 삭제 대상 Job ID 조회
            const jobsToDelete = await tx.job.findMany({
                where,
                select: { id: true },
            });

            const jobIds = jobsToDelete.map(j => j.id);

            if (jobIds.length === 0) {
                return { deletedCount: 0 };
            }

            // 2. 관련 JobLog 먼저 삭제
            await tx.jobLog.deleteMany({
                where: { jobId: { in: jobIds } },
            });

            // 3. Job 삭제
            const deleteResult = await tx.job.deleteMany({
                where: { id: { in: jobIds } },
            });

            return { deletedCount: deleteResult.count };
        });

        const filterLabels: Record<DeleteFilterType, string> = {
            [DeleteFilterType.ALL]: '전체',
            [DeleteFilterType.COMPLETED]: '완료된',
            [DeleteFilterType.FAILED]: '실패한',
            [DeleteFilterType.OLD]: '오래된',
        };

        this.logger.log(
            `사용자 ${userId}의 ${filterLabels[filter]} 작업 ${result.deletedCount}개 삭제 완료`
        );

        return {
            deletedCount: result.deletedCount,
            message: `${filterLabels[filter]} 작업 ${result.deletedCount}개가 삭제되었습니다`,
        };
    }

    /**
     * 단일 작업 삭제
     * @param userId 사용자 ID
     * @param jobId 삭제할 Job ID
     */
    async deleteOne(userId: string, jobId: string): Promise<DeleteJobsResult> {
        // 소유권 확인
        const job = await this.prisma.job.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            throw new NotFoundException('작업을 찾을 수 없습니다');
        }

        if (job.userId !== userId) {
            throw new ForbiddenException('접근 권한이 없습니다');
        }

        // 진행 중인 작업은 삭제 불가
        if (job.status === 'PENDING' || job.status === 'PROCESSING') {
            throw new ForbiddenException('진행 중인 작업은 삭제할 수 없습니다');
        }

        // 트랜잭션으로 삭제
        await this.prisma.$transaction(async (tx) => {
            await tx.jobLog.deleteMany({ where: { jobId } });
            await tx.job.delete({ where: { id: jobId } });
        });

        this.logger.log(`작업 ${jobId} 삭제 완료`);

        return {
            deletedCount: 1,
            message: '작업이 삭제되었습니다',
        };
    }
}

