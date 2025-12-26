/**
 * NaverSession 서비스
 * 네이버 세션 비즈니스 로직 (NaverAccount 기반)
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
   * NaverAccount 정보도 함께 반환
   */
  async findAllByUserId(userId: string) {
    return this.prisma.naverSession.findMany({
      where: {
        naverAccount: {
          userId,
        },
      },
      include: {
        naverAccount: {
          select: {
            id: true,
            loginId: true,
            displayName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 네이버 세션 상세 조회
   */
  async findOne(id: string, userId: string) {
    const session = await this.prisma.naverSession.findUnique({
      where: { id },
      include: {
        naverAccount: {
          select: {
            id: true,
            userId: true,
            loginId: true,
            displayName: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('네이버 세션을 찾을 수 없습니다');
    }

    // 소유권 검사: 세션의 NaverAccount가 해당 사용자의 것인지 확인
    if (session.naverAccount.userId !== userId) {
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
        naverAccount: {
          userId,
        },
        status: 'HEALTHY',
      },
      include: {
        naverAccount: {
          select: {
            id: true,
            loginId: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * 특정 NaverAccount의 활성 세션 조회
   */
  async findActiveSessionByAccountId(naverAccountId: string) {
    return this.prisma.naverSession.findFirst({
      where: {
        naverAccountId,
        status: 'HEALTHY',
      },
    });
  }

  /**
   * 새 네이버 세션 연동 시작
   * NaverAccount ID를 기반으로 세션 생성
   */
  async create(userId: string, dto: CreateNaverSessionDto) {
    this.logger.log(
      `네이버 세션 생성 시작: userId=${userId}, naverAccountId=${dto.naverAccountId}`
    );

    // NaverAccount 소유권 확인
    const account = await this.prisma.naverAccount.findUnique({
      where: { id: dto.naverAccountId },
    });

    if (!account) {
      throw new NotFoundException('네이버 계정을 찾을 수 없습니다');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('해당 네이버 계정에 대한 접근 권한이 없습니다');
    }

    // 이미 PENDING/HEALTHY 세션이 있는지 확인
    const existingSession = await this.prisma.naverSession.findFirst({
      where: {
        naverAccountId: dto.naverAccountId,
        status: { in: ['PENDING', 'HEALTHY'] },
      },
    });

    if (existingSession) {
      if (existingSession.status === 'PENDING') {
        throw new ConflictException('이미 세션 연동이 진행 중입니다');
      }
      if (existingSession.status === 'HEALTHY') {
        throw new ConflictException('이미 활성화된 세션이 있습니다');
      }
    }

    // 프로필 디렉토리 경로 생성 (계정 ID + UUID)
    const profileDir = `naver-${account.loginId}-${randomUUID().slice(0, 8)}`;

    // 세션 레코드 생성 (PENDING 상태)
    const session = await this.prisma.naverSession.create({
      data: {
        naverAccountId: dto.naverAccountId,
        profileDir,
        status: 'PENDING',
      },
      include: {
        naverAccount: {
          select: {
            id: true,
            loginId: true,
            displayName: true,
          },
        },
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
          naverAccountId: dto.naverAccountId,
          naverSessionId: session.id,
          profileDir,
        },
      });

      this.logger.log(
        `INIT_SESSION Job 생성 성공: sessionId=${session.id}, naverAccountId=${dto.naverAccountId}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `INIT_SESSION Job 생성 실패: sessionId=${session.id}, error=${message}`,
        error instanceof Error ? error.stack : undefined
      );

      // Job 생성 실패 시 세션 상태를 ERROR로 업데이트
      await this.prisma.naverSession.update({
        where: { id: session.id },
        data: {
          status: 'ERROR',
          errorMessage: `INIT_SESSION job 생성 실패: ${message}`,
        },
      });

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
        naverAccountId: session.naverAccountId,
        naverSessionId: id,
        profileDir: session.profileDir,
        isReconnect: true,
      },
    });

    return this.findOne(id, userId);
  }

  /**
   * 네이버 세션 검증
   * 실제 로그인 상태와 닉네임을 확인하는 Job 생성
   */
  async verify(id: string, userId: string) {
    const session = await this.findOne(id, userId);

    if (session.status === 'PENDING') {
      throw new ConflictException('세션 연동이 진행 중입니다');
    }

    this.logger.log(`세션 검증 시작: sessionId=${id}`);

    // 검증 Job 생성
    await this.jobService.createJob({
      type: 'VERIFY_SESSION',
      userId,
      payload: {
        naverSessionId: id,
        profileDir: session.profileDir,
      },
    });

    return {
      message: '세션 검증이 시작되었습니다',
      sessionId: id,
    };
  }

  /**
   * 세션 상태 업데이트 (Worker에서 호출)
   */
  async updateStatus(
    id: string,
    status: 'HEALTHY' | 'EXPIRING' | 'EXPIRED' | 'CHALLENGE_REQUIRED' | 'ERROR',
    options?: {
      errorMessage?: string;
    }
  ) {
    return this.prisma.naverSession.update({
      where: { id },
      data: {
        status,
        errorMessage: options?.errorMessage || null,
        lastVerifiedAt: status === 'HEALTHY' ? new Date() : undefined,
      },
    });
  }
}
