/**
 * NaverAccount 모듈
 * 네이버 계정 관리 기능
 */

import { Module } from '@nestjs/common';
import { NaverAccountController } from './naver-account.controller';
import { NaverAccountService } from './naver-account.service';
import { PrismaModule } from '@/common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NaverAccountController],
  providers: [NaverAccountService],
  exports: [NaverAccountService],
})
export class NaverAccountModule {}






