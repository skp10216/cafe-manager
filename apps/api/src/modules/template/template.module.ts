/**
 * Template 모듈
 * 게시글 템플릿 및 이미지 관리
 */

import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { TemplateImageService } from './template-image.service';
import { JobModule } from '../job/job.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [JobModule, UploadModule],
  controllers: [TemplateController],
  providers: [TemplateService, TemplateImageService],
  exports: [TemplateService, TemplateImageService],
})
export class TemplateModule {}











