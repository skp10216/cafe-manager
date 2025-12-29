/**
 * Schedule 컨트롤러
 * 스케줄 CRUD 및 상태 토글 API
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleRunner } from './schedule.runner';
import { ScheduleRunService } from '../schedule-run/schedule-run.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ToggleScheduleDto } from './dto/toggle-schedule.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly scheduleRunner: ScheduleRunner,
    private readonly scheduleRunService: ScheduleRunService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 스케줄 목록 조회
   * GET /api/schedules
   */
  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto
  ) {
    return this.scheduleService.findAll(user.userId, query);
  }

  /**
   * 스케줄 상세 조회
   * GET /api/schedules/:id
   */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.scheduleService.findOne(id, user.userId);
  }

  /**
   * 스케줄 생성
   * POST /api/schedules
   */
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateScheduleDto
  ) {
    return this.scheduleService.create(user.userId, dto);
  }

  /**
   * 스케줄 수정
   * PATCH /api/schedules/:id
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto
  ) {
    return this.scheduleService.update(id, user.userId, dto);
  }

  /**
   * 스케줄 삭제
   * DELETE /api/schedules/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.scheduleService.remove(id, user.userId);
  }

  /**
   * 스케줄 상태 토글 (활성화/비활성화) - 레거시
   * PATCH /api/schedules/:id/toggle
   */
  @Patch(':id/toggle')
  async toggle(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ToggleScheduleDto
  ) {
    return this.scheduleService.toggle(id, user.userId, dto.status);
  }

  /**
   * 사용자 활성화 토글 (userEnabled)
   * PATCH /api/schedules/:id/toggle-enabled
   */
  @Patch(':id/toggle-enabled')
  async toggleEnabled(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: { enabled: boolean }
  ) {
    return this.scheduleService.toggleUserEnabled(id, user.userId, dto.enabled);
  }

  /**
   * 스케줄 즉시 실행 (JIT 방식)
   * POST /api/schedules/:id/run-now
   * 
   * [JIT 개선] 첫 Job만 즉시 생성, 나머지는 Cron이 순차 생성
   * - 모니터링 명확화: 대기 Job이 0~1개로 유지
   * - 취소/수정 용이: nextPostAt만 조정하면 됨
   */
  @Post(':id/run-now')
  async runNow(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    // 1. 스케줄 조회 (권한 확인 포함)
    await this.scheduleService.findOne(id, user.userId);

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // "2025-12-26"

    // 2. 템플릿 정보 포함하여 다시 조회
    const fullSchedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              select: { id: true, path: true, order: true },
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

    if (!fullSchedule) {
      throw new BadRequestException('스케줄을 찾을 수 없습니다');
    }

    // 3. ScheduleRun 생성/조회
    let run = await this.scheduleRunService.findByScheduleAndDate(
      id,
      new Date(today),
    );

    if (!run) {
      run = await this.scheduleRunService.createOrSkip({
        scheduleId: id,
        userId: user.userId,
        runDate: new Date(today),
      });
    }

    if (!run) {
      throw new BadRequestException('ScheduleRun 생성 실패');
    }

    // totalJobs 미리 설정 (N회 목표 명시)
    await this.scheduleRunService.update(run.id, {
      totalJobs: fullSchedule.dailyPostCount,
      status: 'RUNNING',
    });

    // 4. [핵심] nextPostAt이 null이거나 미래인 경우 현재 시각으로 설정
    //    createSingleJob의 조건부 업데이트(nextPostAt <= now)를 통과하기 위함
    if (!fullSchedule.nextPostAt || fullSchedule.nextPostAt > now) {
      // 하루가 바뀌었는지 확인 (todayPostedCount 리셋 필요 여부)
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const shouldResetCount = !fullSchedule.lastRunDate || fullSchedule.lastRunDate < todayStart;

      await this.prisma.schedule.update({
        where: { id },
        data: { 
          nextPostAt: now,
          todayPostedCount: shouldResetCount ? 0 : undefined,
        },
      });
      
      // fullSchedule 객체도 업데이트 (createSingleJob에서 참조)
      (fullSchedule as any).nextPostAt = now;
      if (shouldResetCount) {
        (fullSchedule as any).todayPostedCount = 0;
      }
    }

    // 5. [JIT] 첫 번째 Job만 즉시 생성
    const job = await this.scheduleRunner.createSingleJob(
      fullSchedule,
      run,
      null,
      now,
    );

    if (!job) {
      // 이미 목표 달성 또는 조건 미충족
      throw new BadRequestException(
        '오늘 목표를 이미 달성했거나 스케줄이 비활성화 상태입니다'
      );
    }

    return {
      success: true,
      runId: run.id,
      jobId: job.id,
      message: `첫 번째 포스팅 Job 생성 완료. 나머지 ${fullSchedule.dailyPostCount - 1}개는 ${fullSchedule.postIntervalMinutes}분 간격으로 자동 생성됩니다.`,
    };
  }
}










