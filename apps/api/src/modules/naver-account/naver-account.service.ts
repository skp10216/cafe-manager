/**
 * NaverAccount 서비스
 * 네이버 계정 비즈니스 로직 (User와 네이버 계정 분리)
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { CreateNaverAccountDto } from './dto/create-naver-account.dto';
import { UpdateNaverAccountDto } from './dto/update-naver-account.dto';
import { encrypt } from '@cafe-manager/core';

@Injectable()
export class NaverAccountService {
  private readonly logger = new Logger(NaverAccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자의 모든 네이버 계정 조회
   * 비밀번호는 제외하고 반환
   */
  async findAllByUserId(userId: string) {
    const accounts = await this.prisma.naverAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          select: {
            id: true,
            status: true,
            lastVerifiedAt: true,
          },
        },
      },
    });

    // 비밀번호 필드 제거 후 반환
    return accounts.map((account) => ({
      ...account,
      passwordEncrypted: undefined, // 응답에서 제거
    }));
  }

  /**
   * 네이버 계정 상세 조회
   */
  async findOne(id: string, userId: string) {
    const account = await this.prisma.naverAccount.findUnique({
      where: { id },
      include: {
        sessions: {
          select: {
            id: true,
            status: true,
            lastVerifiedAt: true,
            errorMessage: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('네이버 계정을 찾을 수 없습니다');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    // 비밀번호 필드 제거 후 반환
    return {
      ...account,
      passwordEncrypted: undefined,
    };
  }

  /**
   * 네이버 계정 조회 (비밀번호 포함 - 내부 전용)
   * Worker에서 로그인에 사용하기 위해 암호화된 비밀번호도 반환
   */
  async findOneWithPassword(id: string) {
    const account = await this.prisma.naverAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('네이버 계정을 찾을 수 없습니다');
    }

    return account;
  }

  /**
   * 새 네이버 계정 등록
   */
  async create(userId: string, dto: CreateNaverAccountDto) {
    this.logger.log(
      `네이버 계정 등록 시작: userId=${userId}, loginId=${dto.loginId}`
    );

    // 동일 사용자의 중복 네이버 아이디 체크
    const existing = await this.prisma.naverAccount.findFirst({
      where: {
        userId,
        loginId: dto.loginId,
      },
    });

    if (existing) {
      throw new ConflictException('이미 등록된 네이버 아이디입니다');
    }

    // 비밀번호 암호화
    const passwordEncrypted = encrypt(dto.password);

    // DB 저장
    const account = await this.prisma.naverAccount.create({
      data: {
        userId,
        loginId: dto.loginId,
        passwordEncrypted,
        displayName: dto.displayName || dto.loginId,
        status: 'ACTIVE',
      },
    });

    this.logger.log(
      `네이버 계정 등록 완료: accountId=${account.id}, loginId=${account.loginId}`
    );

    // 비밀번호 제외하고 반환
    return {
      ...account,
      passwordEncrypted: undefined,
    };
  }

  /**
   * 네이버 계정 정보 수정
   */
  async update(id: string, userId: string, dto: UpdateNaverAccountDto) {
    // 소유권 확인
    await this.findOne(id, userId);

    const updateData: Record<string, unknown> = {};

    if (dto.displayName !== undefined) {
      updateData.displayName = dto.displayName;
    }

    if (dto.password) {
      // 비밀번호 변경 시 암호화
      updateData.passwordEncrypted = encrypt(dto.password);
      // 비밀번호 변경 후 기존 세션들은 재인증 필요할 수 있음
      updateData.lastLoginStatus = null;
      updateData.lastLoginError = null;
    }

    const account = await this.prisma.naverAccount.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`네이버 계정 수정 완료: accountId=${id}`);

    return {
      ...account,
      passwordEncrypted: undefined,
    };
  }

  /**
   * 네이버 계정 삭제
   * 연결된 세션도 함께 삭제됨 (Cascade)
   */
  async remove(id: string, userId: string) {
    // 소유권 확인
    await this.findOne(id, userId);

    await this.prisma.naverAccount.delete({
      where: { id },
    });

    this.logger.log(`네이버 계정 삭제 완료: accountId=${id}`);
  }

  /**
   * 계정 상태 업데이트 (Worker에서 호출)
   */
  async updateLoginStatus(
    id: string,
    options: {
      status?: 'ACTIVE' | 'LOGIN_FAILED' | 'DISABLED';
      lastLoginAt?: Date;
      lastLoginStatus?: string;
      lastLoginError?: string;
    }
  ) {
    return this.prisma.naverAccount.update({
      where: { id },
      data: {
        status: options.status,
        lastLoginAt: options.lastLoginAt,
        lastLoginStatus: options.lastLoginStatus,
        lastLoginError: options.lastLoginError || null,
      },
    });
  }

  /**
   * 사용자의 활성 계정 목록 조회
   */
  async findActiveAccounts(userId: string) {
    return this.prisma.naverAccount.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}






