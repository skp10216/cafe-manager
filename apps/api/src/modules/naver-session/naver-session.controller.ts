/**
 * NaverSession 컨트롤러
 * 네이버 세션 연동 API (NaverAccount 기반)
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NaverSessionService } from './naver-session.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CreateNaverSessionDto } from './dto/create-naver-session.dto';

@Controller('naver-sessions')
@UseGuards(JwtAuthGuard)
export class NaverSessionController {
  constructor(private readonly naverSessionService: NaverSessionService) {}

  /**
   * 내 네이버 세션 목록 조회
   * GET /api/naver-sessions
   */
  @Get()
  async findAll(@CurrentUser() user: RequestUser) {
    return this.naverSessionService.findAllByUserId(user.userId);
  }

  /**
   * 네이버 세션 상세 조회
   * GET /api/naver-sessions/:id
   */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.naverSessionService.findOne(id, user.userId);
  }

  /**
   * 새 네이버 세션 연동 시작
   * POST /api/naver-sessions
   * Body: { naverAccountId: string }
   */
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateNaverSessionDto
  ) {
    return this.naverSessionService.create(user.userId, dto);
  }

  /**
   * 네이버 세션 삭제
   * DELETE /api/naver-sessions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.naverSessionService.remove(id, user.userId);
  }

  /**
   * 네이버 세션 재연동 (만료된 세션 갱신)
   * POST /api/naver-sessions/:id/reconnect
   */
  @Post(':id/reconnect')
  async reconnect(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.naverSessionService.reconnect(id, user.userId);
  }

  /**
   * 네이버 세션 검증 (실제 로그인 상태 + 닉네임 확인)
   * POST /api/naver-sessions/:id/verify
   */
  @Post(':id/verify')
  async verify(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.naverSessionService.verify(id, user.userId);
  }
}
