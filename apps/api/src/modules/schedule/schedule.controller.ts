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
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ToggleScheduleDto } from './dto/toggle-schedule.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

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
}

