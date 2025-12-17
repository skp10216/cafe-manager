/**
 * Schedule 모듈
 * 자동 포스팅 스케줄 관리
 */

import { Module, forwardRef } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleRunner } from './schedule.runner';
import { JobModule } from '../job/job.module';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [forwardRef(() => JobModule), forwardRef(() => TemplateModule)],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRunner],
  exports: [ScheduleService],
})
export class ScheduleModule {}









