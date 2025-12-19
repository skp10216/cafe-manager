/**
 * Schedule 서비스
 * 스케줄 비즈니스 로직
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
  createPaginationMeta,
} from '@/common/dto/pagination.dto';
import { Schedule, ScheduleStatus } from '@prisma/client';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 스케줄 목록 조회 (페이지네이션)
   */
  async findAll(
    userId: string,
    query: PaginationQueryDto
  ): Promise<PaginatedResponse<Schedule>> {
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

    return {
      data,
      meta: createPaginationMeta(page, limit, total),
    };
  }

  /**
   * 스케줄 상세 조회
   */
  async findOne(id: string, userId: string) {
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
   */
  async create(userId: string, dto: CreateScheduleDto) {
    // cronExpr 또는 intervalMinutes 중 하나는 필수
    if (!dto.cronExpr && !dto.intervalMinutes) {
      throw new BadRequestException(
        'cron 표현식 또는 실행 간격(분) 중 하나를 입력하세요'
      );
    }

    // 템플릿 존재 및 소유권 확인
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw new NotFoundException('템플릿을 찾을 수 없습니다');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('해당 템플릿에 접근할 수 없습니다');
    }

    // 다음 실행 시간 계산
    const nextRunAt = this.calculateNextRunAt(dto.cronExpr ?? null, dto.intervalMinutes ?? null);

    return this.prisma.schedule.create({
      data: {
        userId,
        templateId: dto.templateId,
        name: dto.name,
        cronExpr: dto.cronExpr,
        intervalMinutes: dto.intervalMinutes,
        maxPostsPerDay: dto.maxPostsPerDay ?? 10,
        nextRunAt,
        status: 'PAUSED', // 기본값은 비활성화
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            cafeId: true,
            boardId: true,
          },
        },
      },
    });
  }

  /**
   * 스케줄 수정
   */
  async update(id: string, userId: string, dto: UpdateScheduleDto) {
    // 소유권 확인
    await this.findOne(id, userId);

    // 템플릿 변경 시 소유권 확인
    if (dto.templateId) {
      const template = await this.prisma.template.findUnique({
        where: { id: dto.templateId },
      });

      if (!template || template.userId !== userId) {
        throw new ForbiddenException('해당 템플릿에 접근할 수 없습니다');
      }
    }

    return this.prisma.schedule.update({
      where: { id },
      data: dto,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            cafeId: true,
            boardId: true,
          },
        },
      },
    });
  }

  /**
   * 스케줄 삭제
   */
  async remove(id: string, userId: string) {
    // 소유권 확인
    await this.findOne(id, userId);

    await this.prisma.schedule.delete({
      where: { id },
    });
  }

  /**
   * 스케줄 상태 토글
   */
  async toggle(id: string, userId: string, status: ScheduleStatus) {
    // 소유권 확인
    const schedule = await this.findOne(id, userId);

    const updateData: Record<string, unknown> = { status };

    // 활성화 시 다음 실행 시간 재계산
    if (status === 'ACTIVE') {
      updateData.nextRunAt = this.calculateNextRunAt(
        schedule.cronExpr,
        schedule.intervalMinutes
      );
      // 오늘 포스팅 카운트 리셋 (날짜가 바뀌었을 수 있음)
      updateData.todayPostCount = 0;
    }

    return this.prisma.schedule.update({
      where: { id },
      data: updateData,
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
   * - 템플릿 정보 + 이미지 목록 포함
   */
  async findSchedulesToRun() {
    const now = new Date();

    return this.prisma.schedule.findMany({
      where: {
        status: 'ACTIVE',
        nextRunAt: {
          lte: now,
        },
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
   * 스케줄 실행 후 상태 업데이트
   */
  async markAsRun(id: string) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) return;

    const now = new Date();
    const nextRunAt = this.calculateNextRunAt(
      schedule.cronExpr,
      schedule.intervalMinutes
    );

    await this.prisma.schedule.update({
      where: { id },
      data: {
        lastRunAt: now,
        nextRunAt,
        todayPostCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * 다음 실행 시간 계산
   */
  private calculateNextRunAt(
    cronExpr: string | null,
    intervalMinutes: number | null
  ): Date {
    const now = new Date();

    // 간단한 간격 기반 계산
    if (intervalMinutes) {
      return new Date(now.getTime() + intervalMinutes * 60 * 1000);
    }

    // cron 표현식은 복잡하므로 기본값으로 1시간 후 설정
    // 실제 구현에서는 cron-parser 라이브러리 사용 권장
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

