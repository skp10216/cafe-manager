/**
 * Template 모듈
 * 게시글 템플릿 관리
 */

import { Module } from '@nestjs/common';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { JobModule } from '../job/job.module';

@Module({
  imports: [JobModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}









