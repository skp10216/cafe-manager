/**
 * Prisma Seed Script
 * 테스트용 초기 데이터 생성
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 테스트 사용자 생성
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('test1234', saltRounds);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@test.com' },
    update: {},
    create: {
      email: 'test@test.com',
      passwordHash,
      name: '테스트 사용자',
      role: 'USER',
    },
  });

  console.log('✅ 테스트 사용자 생성:', testUser.email);

  // 관리자 사용자 생성
  const adminPasswordHash = await bcrypt.hash('admin1234', saltRounds);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      name: '관리자',
      role: 'ADMIN',
    },
  });

  console.log('✅ 관리자 사용자 생성:', adminUser.email);

  console.log('\n📋 로그인 정보:');
  console.log('  - 일반 사용자: test@test.com / test1234');
  console.log('  - 관리자: admin@test.com / admin1234');
  console.log('\n🎉 Seeding 완료!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




