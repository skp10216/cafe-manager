/**
 * Admin 컨트롤러
 * 관리자 운영 콘솔 API
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { AdminService, AdminScheduleQueryDto, AdminSessionQueryDto } from './admin.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AdminStatus, SessionStatus } from '@prisma/client';

/** 스케줄 심사 요청 DTO */
interface ReviewScheduleDto {
  action: 'APPROVE' | 'SUSPEND' | 'BAN' | 'UNSUSPEND';
  reason?: string;
}

/** 일괄 승인 요청 DTO */
interface BulkApproveDto {
  scheduleIds: string[];
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ============================================
  // 대시보드
  // ============================================

  /**
   * 관리자 대시보드 통계
   */
  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ============================================
  // 스케줄 승인 관리
  // ============================================

  /**
   * 스케줄 목록 조회
   */
  @Get('schedules')
  async getSchedules(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('adminStatus') adminStatus?: AdminStatus,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    const query: AdminScheduleQueryDto = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      adminStatus,
      userId,
      search,
    };
    return this.adminService.getSchedules(query);
  }

  /**
   * 승인 대기 스케줄 목록 (바로가기)
   */
  @Get('schedules/pending')
  async getPendingSchedules(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getSchedules({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      adminStatus: 'NEEDS_REVIEW',
    });
  }

  /**
   * 스케줄 심사 (승인/중지/차단/해제)
   */
  @Post('schedules/:id/review')
  async reviewSchedule(
    @Param('id') scheduleId: string,
    @Body() dto: ReviewScheduleDto,
    @CurrentUser() user: { id: string; email: string },
    @Ip() ip: string,
  ) {
    return this.adminService.reviewSchedule({
      adminId: user.id,
      adminEmail: user.email,
      scheduleId,
      action: dto.action,
      reason: dto.reason,
      ipAddress: ip,
    });
  }

  /**
   * 일괄 승인
   */
  @Post('schedules/bulk-approve')
  async bulkApprove(
    @Body() dto: BulkApproveDto,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.adminService.bulkApprove(user.id, user.email, dto.scheduleIds);
  }

  // ============================================
  // 세션 모니터링
  // ============================================

  /**
   * 세션 목록 조회
   */
  @Get('sessions')
  async getSessions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SessionStatus,
    @Query('userId') userId?: string,
  ) {
    const query: AdminSessionQueryDto = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      userId,
    };
    return this.adminService.getSessions(query);
  }

  /**
   * 세션 상태별 집계
   */
  @Get('sessions/counts')
  async getSessionCounts() {
    return this.adminService.getSessionStatusCounts();
  }

  // ============================================
  // 사용자 관리
  // ============================================

  /**
   * 사용자 목록 조회
   */
  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  /**
   * 사용자 상세 조회
   */
  @Get('users/:id')
  async getUserDetail(@Param('id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }
}

