/**
 * ScheduleRun 모듈
 */

import { Module } from '@nestjs/common';
import { ScheduleRunService } from './schedule-run.service';
import { ScheduleRunController } from './schedule-run.controller';
import { PrismaModule } from '@/common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ScheduleRunService],
  controllers: [ScheduleRunController],
  exports: [ScheduleRunService],
})
export class ScheduleRunModule {}
