/**
 * User 컨트롤러
 * 사용자 정보 조회/수정 API
 */

import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 내 정보 조회
   * GET /api/users/me
   */
  @Get('me')
  async getMe(@CurrentUser() user: RequestUser) {
    return this.userService.findById(user.userId);
  }

  /**
   * 내 정보 수정
   * PATCH /api/users/me
   */
  @Patch('me')
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.userService.update(user.userId, dto);
  }
}

