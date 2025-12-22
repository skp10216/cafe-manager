/**
 * 카페매니저 API 루트 모듈
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// 공통 모듈
import { PrismaModule } from './common/prisma/prisma.module';

// 기능 모듈
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { NaverAccountModule } from './modules/naver-account/naver-account.module';
import { NaverSessionModule } from './modules/naver-session/naver-session.module';
import { NaverOAuthModule } from './modules/naver-oauth/naver-oauth.module';
import { TemplateModule } from './modules/template/template.module';
import { ScheduleModule as AppScheduleModule } from './modules/schedule/schedule.module';
import { ManagedPostModule } from './modules/managed-post/managed-post.module';
import { JobModule } from './modules/job/job.module';
import { UploadModule } from './modules/upload/upload.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // 환경변수 설정
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // BullMQ (Job Queue) 설정
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
      inject: [ConfigService],
    }),

    // 정적 파일 서빙 (업로드된 이미지)
    ServeStaticModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: configService.get<string>('UPLOAD_DIR') || 
            join(process.cwd(), 'uploads'),
          serveRoot: '/uploads',
          serveStaticOptions: {
            index: false,
            maxAge: '1d',
          },
        },
      ],
      inject: [ConfigService],
    }),

    // 스케줄러 (cron job용)
    ScheduleModule.forRoot(),

    // Prisma DB 연결
    PrismaModule,

    // 기능 모듈
    AuthModule,
    UserModule,
    NaverAccountModule,
    NaverSessionModule,
    NaverOAuthModule,
    UploadModule,
    TemplateModule,
    AppScheduleModule,
    ManagedPostModule,
    JobModule,
    DashboardModule,
  ],
})
export class AppModule {}
