/**
 * NaverAccount 모듈
 * 네이버 계정 관리 기능
 */

import { Module, forwardRef } from '@nestjs/common';
import { NaverAccountController } from './naver-account.controller';
import { NaverAccountService } from './naver-account.service';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => JobModule), // 계정 생성 시 자동 세션 연동용
  ],
  controllers: [NaverAccountController],
  providers: [NaverAccountService],
  exports: [NaverAccountService],
})
export class NaverAccountModule {}








