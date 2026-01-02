/**
 * AuditLog 모듈
 * 관리자 감사 로그 기능
 */

import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { PrismaModule } from '@/common/prisma/prisma.module';

@Global()  // 전역 모듈로 설정 (다른 모듈에서 import 없이 사용 가능)
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}




