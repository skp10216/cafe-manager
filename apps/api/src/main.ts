/**
 * 카페매니저 API 서버 진입점
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CustomLogger } from './common/logger/custom.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger(),
  });
  const configService = app.get(ConfigService);

  // API 프리픽스 설정
  const apiPrefix = configService.get<string>('API_PREFIX', '/api');
  app.setGlobalPrefix(apiPrefix);

  // CORS 설정 - 여러 origin 허용 (web: 3000, admin: 3002)
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3002');
  const origins = corsOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  });

  // 전역 Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // 정의되지 않은 속성이 있으면 에러
      transform: true, // 자동 타입 변환
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // 전역 Exception Filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // 서버 시작
  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port);

  console.log(`🚀 카페매니저 API 서버가 포트 ${port}에서 실행 중입니다.`);
  console.log(`📍 API 엔드포인트: http://localhost:${port}${apiPrefix}`);
}

bootstrap();
