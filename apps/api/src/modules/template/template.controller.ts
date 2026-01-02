/**
 * Template 컨트롤러
 * 템플릿 CRUD, 이미지 관리 및 즉시 게시 API
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
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { TemplateService } from './template.service';
import { TemplateImageService } from './template-image.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PostNowDto } from './dto/post-now.dto';
import { ReorderImagesDto } from './dto/template-image.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly templateImageService: TemplateImageService,
  ) {}

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

  // ===========================================
  // 이미지 관리 엔드포인트
  // ===========================================

  /**
   * 템플릿 이미지 목록 조회
   * GET /api/templates/:id/images
   */
  @Get(':id/images')
  async getImages(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.templateImageService.findAll(id, user.userId);
  }

  /**
   * 이미지 업로드 (최대 10개)
   * POST /api/templates/:id/images
   * Content-Type: multipart/form-data
   */
  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadImages(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('업로드할 이미지가 없습니다');
    }

    return this.templateImageService.addImages(id, user.userId, files);
  }

  /**
   * 이미지 순서 변경
   * PATCH /api/templates/:id/images/reorder
   */
  @Patch(':id/images/reorder')
  async reorderImages(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ReorderImagesDto,
  ) {
    return this.templateImageService.reorderImages(id, user.userId, dto.imageIds);
  }

  /**
   * 특정 이미지 삭제
   * DELETE /api/templates/:id/images/:imageId
   */
  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  async deleteImage(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.templateImageService.deleteImage(id, imageId, user.userId);
  }

  /**
   * 템플릿의 모든 이미지 삭제
   * DELETE /api/templates/:id/images
   */
  @Delete(':id/images')
  @HttpCode(HttpStatus.OK)
  async deleteAllImages(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.templateImageService.deleteAllImages(id, user.userId);
  }
}













