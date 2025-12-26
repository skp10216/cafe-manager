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

    return schedule;
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
   * 스케줄 상태 토글 (레거시 status 필드 사용)
   * [변경됨] 활성화 시 nextPostAt 초기화
   */
  async toggle(id: string, userId: string, status: ScheduleStatus) {
    // 소유권 확인
    const schedule = await this.findOne(id, userId);
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
   * [변경됨] 활성화 시 nextPostAt 초기화
   */
  async toggleUserEnabled(id: string, userId: string, enabled: boolean) {
    // 소유권 확인
    const schedule = await this.findOne(id, userId);

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
}

