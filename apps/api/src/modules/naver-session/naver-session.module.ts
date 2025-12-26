/**
 * NaverSession 모듈
 * 네이버 계정 세션 관리
 */

import { Module } from '@nestjs/common';
import { NaverSessionController } from './naver-session.controller';
import { NaverSessionService } from './naver-session.service';
import { JobModule } from '../job/job.module';

@Module({
  imports: [JobModule],
  controllers: [NaverSessionController],
  providers: [NaverSessionService],
  exports: [NaverSessionService],
})
export class NaverSessionModule {}











