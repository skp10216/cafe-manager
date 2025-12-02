/**
 * NaverSession 서비스
 * 네이버 세션 비즈니스 로직
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CreateNaverSessionDto } from './dto/create-naver-session.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class NaverSessionService {
  private readonly logger = new Logger(NaverSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService
  ) {}

  /**
   * 사용자의 모든 네이버 세션 조회
   */
  async findAllByUserId(userId: string) {
    return this.prisma.naverSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 네이버 세션 상세 조회
   */
  async findOne(id: string, userId: string) {
    const session = await this.prisma.naverSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('네이버 세션을 찾을 수 없습니다');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    return session;
  }

  /**
   * 사용자의 활성 세션 조회
   */
  async findActiveSession(userId: string) {
    return this.prisma.naverSession.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });
  }

  /**
   * 새 네이버 계정 연동 시작
   */
  async create(userId: string, dto: CreateNaverSessionDto) {
    this.logger.log(
      `네이버 세션 생성 시작: userId=${userId}, naverId=${dto.naverId ?? 'N/A'}`
    );

    // 프로필 디렉토리 경로 생성 (고유한 UUID 사용)
    const profileDir = `naver-${userId}-${randomUUID().slice(0, 8)}`;

    // 세션 레코드 생성 (PENDING 상태)
    const session = await this.prisma.naverSession.create({
      data: {
        userId,
        naverId: dto.naverId,
        profileDir,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `네이버 세션 DB 생성 완료: sessionId=${session.id}, profileDir=${profileDir}`
    );

    // 세션 초기화 Job 생성
    try {
      await this.jobService.createJob({
        type: 'INIT_SESSION',
        userId,
        payload: {
          sessionId: session.id,
          profileDir,
          naverId: dto.naverId,
        },
      });

      this.logger.log(
        `INIT_SESSION Job 생성 성공: sessionId=${session.id}, profileDir=${profileDir}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `INIT_SESSION Job 생성 실패: sessionId=${session.id}, error=${message}`,
        error instanceof Error ? error.stack : undefined
      );

      // Job 생성 실패 시 세션 상태를 ERROR로 업데이트하여 UI에서 바로 감지 가능하게 함
      await this.prisma.naverSession.update({
        where: { id: session.id },
        data: {
          status: 'ERROR',
          errorMessage: `INIT_SESSION job 생성 실패: ${message}`,
        },
      });

      // 예외를 다시 던져 프론트에 에러 전달
      throw error;
    }

    return session;
  }

  /**
   * 네이버 세션 삭제
   */
  async remove(id: string, userId: string) {
    // 소유권 확인
    await this.findOne(id, userId);

    await this.prisma.naverSession.delete({
      where: { id },
    });
  }

  /**
   * 네이버 세션 재연동
   */
  async reconnect(id: string, userId: string) {
    const session = await this.findOne(id, userId);

    if (session.status === 'PENDING') {
      throw new ConflictException('이미 연동 진행 중입니다');
    }

    // 상태를 PENDING으로 변경
    await this.prisma.naverSession.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      },
    });

    // 재연동 Job 생성
    await this.jobService.createJob({
      type: 'INIT_SESSION',
      userId,
      payload: {
        sessionId: id,
        profileDir: session.profileDir,
        naverId: session.naverId,
        isReconnect: true,
      },
    });

    return this.findOne(id, userId);
  }

  /**
   * 세션 상태 업데이트 (Worker에서 호출)
   */
  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'EXPIRED' | 'ERROR',
    options?: {
      errorMessage?: string;
      naverId?: string;
    }
  ) {
    return this.prisma.naverSession.update({
      where: { id },
      data: {
        status,
        errorMessage: options?.errorMessage || null,
        naverId: options?.naverId,
        lastVerifiedAt: status === 'ACTIVE' ? new Date() : undefined,
      },
    });
  }
}

