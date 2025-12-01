/**
 * Template 서비스
 * 템플릿 비즈니스 로직
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JobService } from '../job/job.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PostNowDto } from './dto/post-now.dto';
import {
  PaginationQueryDto,
  PaginatedResponse,
  createPaginationMeta,
} from '@/common/dto/pagination.dto';
import { Template } from '@prisma/client';

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService
  ) {}

  /**
   * 템플릿 목록 조회 (페이지네이션)
   */
  async findAll(
    userId: string,
    query: PaginationQueryDto
  ): Promise<PaginatedResponse<Template>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.template.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.template.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: createPaginationMeta(page, limit, total),
    };
  }

  /**
   * 템플릿 상세 조회
   */
  async findOne(id: string, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('템플릿을 찾을 수 없습니다');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    return template;
  }

  /**
   * 템플릿 생성
   */
  async create(userId: string, dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        userId,
        ...dto,
      },
    });
  }

  /**
   * 템플릿 수정
   */
  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    // 소유권 확인
    await this.findOne(id, userId);

    return this.prisma.template.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 템플릿 삭제
   */
  async remove(id: string, userId: string) {
    // 소유권 확인
    await this.findOne(id, userId);

    await this.prisma.template.delete({
      where: { id },
    });
  }

  /**
   * 즉시 게시
   * 템플릿 기반으로 게시글 작성 Job 생성
   */
  async postNow(id: string, userId: string, dto: PostNowDto) {
    const template = await this.findOne(id, userId);

    // 템플릿 변수 치환
    const title = this.replaceVariables(template.subjectTemplate, dto.variables);
    const content = this.replaceVariables(template.contentTemplate, dto.variables);

    // 게시 Job 생성
    const job = await this.jobService.createJob({
      type: 'CREATE_POST',
      userId,
      payload: {
        templateId: id,
        cafeId: template.cafeId,
        boardId: template.boardId,
        title,
        content,
      },
    });

    return {
      message: '게시 작업이 등록되었습니다',
      jobId: job.id,
    };
  }

  /**
   * 템플릿 변수 치환
   * {{변수명}} 형식의 플레이스홀더를 실제 값으로 대체
   */
  private replaceVariables(
    template: string,
    variables?: Record<string, string>
  ): string {
    if (!variables) return template;

    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] || `{{${key}}}`;
    });
  }
}

