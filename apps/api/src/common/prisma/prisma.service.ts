/**
 * Prisma 서비스
 * 데이터베이스 연결 및 쿼리 실행
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma 데이터베이스 연결 성공');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Prisma 데이터베이스 연결 해제');
  }

  /**
   * 트랜잭션 헬퍼
   */
  async executeInTransaction<T>(
    fn: (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>
  ): Promise<T> {
    return this.$transaction(fn);
  }
}




