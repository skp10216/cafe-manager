/**
 * NaverAccount 컨트롤러
 * 네이버 계정 관리 API
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NaverAccountService } from './naver-account.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CreateNaverAccountDto, UpdateNaverAccountDto } from './dto';

@Controller('naver-accounts')
@UseGuards(JwtAuthGuard)
export class NaverAccountController {
  constructor(private readonly naverAccountService: NaverAccountService) {}

  /**
   * 내 네이버 계정 목록 조회
   * GET /api/naver-accounts
   */
  @Get()
  async findAll(@CurrentUser() user: RequestUser) {
    return this.naverAccountService.findAllByUserId(user.userId);
  }

  /**
   * 네이버 계정 상세 조회
   * GET /api/naver-accounts/:id
   */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.naverAccountService.findOne(id, user.userId);
  }

  /**
   * 새 네이버 계정 등록
   * POST /api/naver-accounts
   */
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateNaverAccountDto
  ) {
    return this.naverAccountService.create(user.userId, dto);
  }

  /**
   * 네이버 계정 수정
   * PATCH /api/naver-accounts/:id
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateNaverAccountDto
  ) {
    return this.naverAccountService.update(id, user.userId, dto);
  }

  /**
   * 네이버 계정 삭제
   * DELETE /api/naver-accounts/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.naverAccountService.remove(id, user.userId);
  }
}










