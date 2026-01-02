/**
 * ManagedPost 컨트롤러
 * 게시글 목록 조회 및 동기화 API
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ManagedPostService } from './managed-post.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { ManagedPostQueryDto } from './dto/managed-post-query.dto';

@Controller('managed-posts')
@UseGuards(JwtAuthGuard)
export class ManagedPostController {
  constructor(private readonly managedPostService: ManagedPostService) {}

  /**
   * 게시글 목록 조회
   * GET /api/managed-posts
   */
  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: ManagedPostQueryDto
  ) {
    return this.managedPostService.findAll(user.userId, query);
  }

  /**
   * 게시글 상세 조회
   * GET /api/managed-posts/:id
   */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.managedPostService.findOne(id, user.userId);
  }

  /**
   * "내가 쓴 글" 동기화 요청
   * POST /api/managed-posts/sync
   */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestSync(@CurrentUser() user: RequestUser) {
    return this.managedPostService.requestSync(user.userId);
  }

  /**
   * 카페별 게시글 통계
   * GET /api/managed-posts/stats
   */
  @Get('stats/summary')
  async getStats(@CurrentUser() user: RequestUser) {
    return this.managedPostService.getStats(user.userId);
  }
}













