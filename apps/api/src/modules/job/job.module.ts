/**
 * Job 모듈
 * 백그라운드 작업 관리
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobController } from './job.controller';
import { JobService } from './job.service';
import { JobProducer } from './job.producer';
import { QUEUE_NAMES } from '@/common/constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAMES.CAFE_JOBS,
    }),
  ],
  controllers: [JobController],
  providers: [JobService, JobProducer],
  exports: [JobService, JobProducer],
})
export class JobModule {}

