/**
 * ManagedPost 모듈
 * 동기화된 게시글 관리
 */

import { Module } from '@nestjs/common';
import { ManagedPostController } from './managed-post.controller';
import { ManagedPostService } from './managed-post.service';
import { JobModule } from '../job/job.module';

@Module({
  imports: [JobModule],
  controllers: [ManagedPostController],
  providers: [ManagedPostService],
  exports: [ManagedPostService],
})
export class ManagedPostModule {}













