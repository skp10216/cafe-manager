/**
 * NaverOAuth 서비스
 * - 네이버 공식 로그인(OAuth2) 기반 계정 연결 비즈니스 로직
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/common/prisma/prisma.service';
import { encrypt, decrypt } from '@cafe-manager/core';
import { randomBytes } from 'crypto';
import { NaverOAuthAccountResponse } from './dto/naver-oauth-account.response';

/** OAuth state 유효 시간 (10분) */
const STATE_EXPIRES_MINUTES = 10;

/** 네이버 토큰 응답 타입 */
interface NaverTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/** 네이버 프로필 응답 타입 */
interface NaverProfileResponse {
  resultcode: string;
  message: string;
  response: {
    id: string;
    email?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
  };
}

@Injectable()
export class NaverOAuthService {
  private readonly logger = new Logger(NaverOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  // ===========================================
  // OAuth 인증 시작
  // ===========================================

  /**
   * OAuth 인증 시작 - state 생성 및 네이버 로그인 URL 반환
   */
  async initiateOAuth(userId: string): Promise<{ authUrl: string; state: string }> {
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const redirectUri = this.configService.get<string>('NAVER_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      throw new BadRequestException('네이버 OAuth 설정이 누락되었습니다');
    }

    // state 생성 (CSRF 방지)
    const state = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + STATE_EXPIRES_MINUTES * 60 * 1000);

    // DB에 state 저장
    await this.prisma.naverOAuthState.create({
      data: {
        userId,
        state,
        expiresAt,
      },
    });

    // 네이버 로그인 URL 생성
    const authUrl = new URL('https://nid.naver.com/oauth2.0/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);

    this.logger.log(`OAuth 인증 시작: userId=${userId}`);

    return {
      authUrl: authUrl.toString(),
      state,
    };
  }

  // ===========================================
  // OAuth 콜백 처리
  // ===========================================

  /**
   * OAuth 콜백 처리 - 코드 → 토큰 교환 → 프로필 조회 → 계정 저장/업데이트
   */
  async handleCallback(
    userId: string,
    code: string,
    state: string
  ): Promise<NaverOAuthAccountResponse> {
    // 1. state 검증
    const stateRecord = await this.prisma.naverOAuthState.findUnique({
      where: { state },
    });

    if (!stateRecord) {
      throw new UnauthorizedException('유효하지 않은 state입니다');
    }

    if (stateRecord.userId !== userId) {
      throw new ForbiddenException('state가 현재 사용자와 일치하지 않습니다');
    }

    if (stateRecord.usedAt) {
      throw new BadRequestException('이미 사용된 state입니다');
    }

    if (new Date() > stateRecord.expiresAt) {
      throw new BadRequestException('만료된 state입니다');
    }

    // state 사용 처리
    await this.prisma.naverOAuthState.update({
      where: { state },
      data: { usedAt: new Date() },
    });

    // 2. 코드 → 토큰 교환
    const tokenData = await this.exchangeCodeForToken(code, state);

    // 3. 프로필 조회
    const profile = await this.fetchNaverProfile(tokenData.access_token);

    // 4. 계정 저장/업데이트 (upsert)
    const account = await this.upsertOAuthAccount(userId, tokenData, profile);

    this.logger.log(
      `OAuth 계정 연결 완료: userId=${userId}, naverUserId=${profile.id}`
    );

    return this.toResponse(account);
  }

  /**
   * 코드 → 토큰 교환
   */
  private async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
  }> {
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.get<string>('NAVER_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('NAVER_REDIRECT_URI');

    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    tokenUrl.searchParams.set('client_id', clientId!);
    tokenUrl.searchParams.set('client_secret', clientSecret!);
    tokenUrl.searchParams.set('redirect_uri', redirectUri!);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('state', state);

    const response = await fetch(tokenUrl.toString(), { method: 'POST' });
    const data = (await response.json()) as NaverTokenResponse;

    if (data.error) {
      this.logger.error(`토큰 교환 실패: ${data.error_description}`);
      throw new BadRequestException(`토큰 교환 실패: ${data.error_description}`);
    }

    return data;
  }

  /**
   * 네이버 프로필 조회
   */
  private async fetchNaverProfile(accessToken: string): Promise<{
    id: string;
    email?: string;
    nickname?: string;
    name?: string;
    profile_image?: string;
  }> {
    const response = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await response.json()) as NaverProfileResponse;

    if (data.resultcode !== '00') {
      this.logger.error(`프로필 조회 실패: ${data.message}`);
      throw new BadRequestException(`프로필 조회 실패: ${data.message}`);
    }

    return data.response;
  }

  /**
   * OAuth 계정 저장/업데이트
   */
  private async upsertOAuthAccount(
    userId: string,
    tokenData: {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
    },
    profile: {
      id: string;
      email?: string;
      nickname?: string;
      name?: string;
      profile_image?: string;
    }
  ) {
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    return this.prisma.naverOAuthAccount.upsert({
      where: {
        userId_naverUserId: {
          userId,
          naverUserId: profile.id,
        },
      },
      create: {
        userId,
        naverUserId: profile.id,
        email: profile.email,
        nickname: profile.nickname,
        name: profile.name,
        profileImageUrl: profile.profile_image,
        accessTokenEncrypted: encrypt(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : null,
        tokenType: tokenData.token_type,
        tokenExpiresAt,
      },
      update: {
        email: profile.email,
        nickname: profile.nickname,
        name: profile.name,
        profileImageUrl: profile.profile_image,
        accessTokenEncrypted: encrypt(tokenData.access_token),
        refreshTokenEncrypted: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : null,
        tokenType: tokenData.token_type,
        tokenExpiresAt,
      },
    });
  }

  // ===========================================
  // 계정 조회/삭제
  // ===========================================

  /**
   * 사용자의 OAuth 연결 계정 목록 조회
   */
  async findAllByUserId(userId: string): Promise<NaverOAuthAccountResponse[]> {
    const accounts = await this.prisma.naverOAuthAccount.findMany({
      where: { userId },
      orderBy: { connectedAt: 'desc' },
    });

    return accounts.map((a) => this.toResponse(a));
  }

  /**
   * OAuth 계정 상세 조회
   */
  async findOne(id: string, userId: string): Promise<NaverOAuthAccountResponse> {
    const account = await this.prisma.naverOAuthAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('OAuth 계정을 찾을 수 없습니다');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    return this.toResponse(account);
  }

  /**
   * OAuth 계정 연결 해제 (삭제)
   */
  async disconnect(id: string, userId: string): Promise<void> {
    const account = await this.prisma.naverOAuthAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('OAuth 계정을 찾을 수 없습니다');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    await this.prisma.naverOAuthAccount.delete({
      where: { id },
    });

    this.logger.log(`OAuth 계정 연결 해제: id=${id}`);
  }

  // ===========================================
  // 토큰 관리 (Runner에서 호출)
  // ===========================================

  /**
   * 만료된 state 정리
   */
  async cleanupStates(): Promise<{ deleted: number }> {
    const result = await this.prisma.naverOAuthState.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // 만료됨
          { usedAt: { not: null } }, // 이미 사용됨
        ],
      },
    });

    return { deleted: result.count };
  }

  /**
   * 만료 임박 토큰 자동 갱신
   */
  async refreshExpiringTokens(options: {
    withinMinutes: number;
    limit: number;
  }): Promise<{ refreshed: number }> {
    const expiresThreshold = new Date(
      Date.now() + options.withinMinutes * 60 * 1000
    );

    // 만료 임박한 계정 조회 (refresh token이 있는 것만)
    const accounts = await this.prisma.naverOAuthAccount.findMany({
      where: {
        tokenExpiresAt: { lt: expiresThreshold },
        refreshTokenEncrypted: { not: null },
      },
      take: options.limit,
    });

    let refreshed = 0;

    for (const account of accounts) {
      try {
        await this.refreshAccountToken(account.id);
        refreshed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(
          `토큰 갱신 실패: accountId=${account.id}, error=${msg}`
        );
      }
    }

    return { refreshed };
  }

  /**
   * 개별 계정 토큰 갱신
   */
  private async refreshAccountToken(accountId: string): Promise<void> {
    const account = await this.prisma.naverOAuthAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.refreshTokenEncrypted) {
      throw new BadRequestException('갱신 가능한 토큰이 없습니다');
    }

    const refreshToken = decrypt(account.refreshTokenEncrypted);
    const clientId = this.configService.get<string>('NAVER_CLIENT_ID');
    const clientSecret = this.configService.get<string>('NAVER_CLIENT_SECRET');

    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
    tokenUrl.searchParams.set('grant_type', 'refresh_token');
    tokenUrl.searchParams.set('client_id', clientId!);
    tokenUrl.searchParams.set('client_secret', clientSecret!);
    tokenUrl.searchParams.set('refresh_token', refreshToken);

    const response = await fetch(tokenUrl.toString(), { method: 'POST' });
    const data = (await response.json()) as NaverTokenResponse;

    if (data.error) {
      throw new BadRequestException(`토큰 갱신 실패: ${data.error_description}`);
    }

    const tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await this.prisma.naverOAuthAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: encrypt(data.access_token),
        refreshTokenEncrypted: data.refresh_token
          ? encrypt(data.refresh_token)
          : account.refreshTokenEncrypted,
        tokenExpiresAt,
      },
    });

    this.logger.log(`토큰 갱신 완료: accountId=${accountId}`);
  }

  // ===========================================
  // 헬퍼
  // ===========================================

  /**
   * DB 모델 → 응답 DTO 변환
   */
  private toResponse(account: {
    id: string;
    naverUserId: string;
    email: string | null;
    nickname: string | null;
    name: string | null;
    profileImageUrl: string | null;
    tokenExpiresAt: Date | null;
    connectedAt: Date;
    updatedAt: Date;
  }): NaverOAuthAccountResponse {
    return {
      id: account.id,
      naverUserId: account.naverUserId,
      email: account.email,
      nickname: account.nickname,
      name: account.name,
      profileImageUrl: account.profileImageUrl,
      tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
      connectedAt: account.connectedAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
