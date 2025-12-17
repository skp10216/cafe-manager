/**
 * NaverOAuth 모듈
 * - 네이버 공식 로그인(OAuth2) 기반 계정 연결
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { NaverOAuthController } from './naver-oauth.controller';
import { NaverOAuthService } from './naver-oauth.service';
import { NaverOAuthRunner } from './naver-oauth.runner';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [NaverOAuthController],
  providers: [NaverOAuthService, NaverOAuthRunner],
  exports: [NaverOAuthService],
})
export class NaverOAuthModule {}


