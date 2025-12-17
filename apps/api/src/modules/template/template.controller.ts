/**
 * Template 컨트롤러
 * 템플릿 CRUD 및 즉시 게시 API
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TemplateService } from './template.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PostNowDto } from './dto/post-now.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  /**
   * 템플릿 목록 조회
   * GET /api/templates
   */
  @Get()
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto
  ) {
    return this.templateService.findAll(user.userId, query);
  }

  /**
   * 템플릿 상세 조회
   * GET /api/templates/:id
   */
  @Get(':id')
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.templateService.findOne(id, user.userId);
  }

  /**
   * 템플릿 생성
   * POST /api/templates
   */
  @Post()
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTemplateDto
  ) {
    return this.templateService.create(user.userId, dto);
  }

  /**
   * 템플릿 수정
   * PATCH /api/templates/:id
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto
  ) {
    return this.templateService.update(id, user.userId, dto);
  }

  /**
   * 템플릿 삭제
   * DELETE /api/templates/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.templateService.remove(id, user.userId);
  }

  /**
   * 즉시 게시
   * POST /api/templates/:id/post-now
   */
  @Post(':id/post-now')
  async postNow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: PostNowDto
  ) {
    return this.templateService.postNow(id, user.userId, dto);
  }
}









