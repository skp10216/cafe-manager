/**
 * AuditLog 컨트롤러
 * 감사 로그 조회 API (Admin 전용)
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuditLogService, AuditLogQueryDto } from './audit-log.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { EntityType } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, AdminGuard)  // Admin 전용
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * 감사 로그 목록 조회
   */
  @Get()
  async findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(query);
  }

  /**
   * 특정 엔티티의 감사 로그 조회
   */
  @Get('entity/:entityType/:entityId')
  async findByEntity(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findByEntity(entityType, entityId);
  }

  /**
   * 특정 사용자의 감사 로그 조회
   */
  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.auditLogService.findByUser(userId);
  }
}




