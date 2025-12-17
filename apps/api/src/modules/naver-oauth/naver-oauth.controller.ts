/**
 * NaverOAuth 컨트롤러
 * - 네이버 공식 로그인(OAuth2) 기반 계정 연결 API
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { NaverOAuthService } from './naver-oauth.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';

@Controller('naver-oauth')
@UseGuards(JwtAuthGuard)
export class NaverOAuthController {
  constructor(private readonly naverOAuthService: NaverOAuthService) {}

  /**
   * OAuth 인증 시작 - 네이버 로그인 URL 반환
   * POST /api/naver-oauth/initiate
   *
   * @returns { authUrl: string; state: string }
   */
  @Post('initiate')
  async initiateOAuth(@CurrentUser() user: RequestUser) {
    return this.naverOAuthService.initiateOAuth(user.userId);
  }

  /**
   * OAuth 콜백 처리 - 코드 → 토큰 교환 → 계정 연결
   * GET /api/naver-oauth/callback?code=xxx&state=xxx
   *
   * @returns NaverOAuthAccountResponse
   */
  @Get('callback')
  async handleCallback(
    @CurrentUser() user: RequestUser,
    @Query('code') code: string,
    @Query('state') state: string
  ) {
    if (!code || !state) {
      throw new BadRequestException('code와 state 파라미터가 필요합니다');
    }

    return this.naverOAuthService.handleCallback(user.userId, code, state);
  }

  /**
   * 내 OAuth 연결 계정 목록 조회
   * GET /api/naver-oauth/accounts
   *
   * @returns NaverOAuthAccountResponse[]
   */
  @Get('accounts')
  async findAll(@CurrentUser() user: RequestUser) {
    return this.naverOAuthService.findAllByUserId(user.userId);
  }

  /**
   * OAuth 계정 상세 조회
   * GET /api/naver-oauth/accounts/:id
   *
   * @returns NaverOAuthAccountResponse
   */
  @Get('accounts/:id')
  async findOne(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string
  ) {
    return this.naverOAuthService.findOne(id, user.userId);
  }

  /**
   * OAuth 계정 연결 해제
   * DELETE /api/naver-oauth/accounts/:id
   */
  @Delete('accounts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string
  ) {
    await this.naverOAuthService.disconnect(id, user.userId);
  }
}
