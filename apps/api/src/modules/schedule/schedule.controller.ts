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
   * 스케줄 상태 토글 (활성화/비활성화)
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
   * 스케줄 즉시 실행
   * POST /api/schedules/:id/run-now
   */
  @Post(':id/run-now')
  async runNow(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    // 1. 스케줄 조회 (권한 확인 포함)
    await this.scheduleService.findOne(id, user.userId);

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // "2025-12-24"

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
      },
    });

    if (!fullSchedule) {
      throw new BadRequestException('스케줄을 찾을 수 없습니다');
    }

    // 3. ScheduleRun 생성 (중복 방지는 createOrSkip에서 처리)
    const run = await this.scheduleRunService.createOrSkip({
      scheduleId: id,
      userId: user.userId,
      runDate: new Date(today),
    });

    if (!run) {
      throw new BadRequestException('오늘은 이미 실행되었습니다');
    }

    // 4. N개 Job 생성
    await this.scheduleRunner.createJobsForRun(fullSchedule, run);

    return { success: true, runId: run.id };
  }
}









