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
import { Template, TemplateImage } from '@prisma/client';

/** 이미지 포함 템플릿 타입 */
type TemplateWithImages = Template & { images: TemplateImage[] };

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService
  ) {}

  /**
   * 템플릿 목록 조회 (페이지네이션)
   * - 이미지 개수 포함
   */
  async findAll(
    userId: string,
    query: PaginationQueryDto
  ): Promise<PaginatedResponse<Template & { imageCount: number }>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { images: true },
          },
        },
      }),
      this.prisma.template.count({ where: { userId } }),
    ]);

    // imageCount 필드 추가
    const data = templates.map(({ _count, ...template }) => ({
      ...template,
      imageCount: _count.images,
    }));

    return {
      data,
      meta: createPaginationMeta(page, limit, total),
    };
  }

  /**
   * 템플릿 상세 조회 (이미지 포함)
   */
  async findOne(id: string, userId: string): Promise<TemplateWithImages> {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
      },
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
        name: dto.name,
        cafeId: dto.cafeId,
        boardId: dto.boardId,
        cafeName: dto.cafeName,
        boardName: dto.boardName,
        subjectTemplate: dto.subjectTemplate,
        contentTemplate: dto.contentTemplate,
        // Prisma Json 타입으로 변환 (배열을 JSON으로 저장)
        variables: dto.variables ? JSON.parse(JSON.stringify(dto.variables)) : [],
        price: dto.price,
        tradeMethod: dto.tradeMethod,
        tradeLocation: dto.tradeLocation,
      },
      include: {
        images: true,
      },
    });
  }

  /**
   * 템플릿 수정
   */
  async update(id: string, userId: string, dto: UpdateTemplateDto) {
    // 소유권 확인
    await this.findOne(id, userId);

    // DTO에서 필요한 필드만 추출하고 variables는 JSON으로 변환
    const { variables, ...rest } = dto;
    const updateData: Record<string, unknown> = { ...rest };
    
    if (variables !== undefined) {
      updateData.variables = JSON.parse(JSON.stringify(variables));
    }

    return this.prisma.template.update({
      where: { id },
      data: updateData,
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  /**
   * 템플릿 삭제
   * - 연관 이미지도 함께 삭제됨 (Cascade)
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

    // 시스템 변수 + 사용자 변수 병합
    const mergedVariables = {
      ...this.getSystemVariables(),
      ...dto.variables,
    };

    // 템플릿 변수 치환
    const title = this.replaceVariables(template.subjectTemplate, mergedVariables);
    const content = this.replaceVariables(template.contentTemplate, mergedVariables);

    // 이미지 경로 목록
    const imagePaths = template.images.map((img) => img.path);

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
        imagePaths,
        // 상품 게시판 정보 (선택적)
        price: template.price,
        tradeMethod: template.tradeMethod,
        tradeLocation: template.tradeLocation,
      },
    });

    return {
      message: '게시 작업이 등록되었습니다',
      jobId: job.id,
      preview: {
        title,
        content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        imageCount: imagePaths.length,
      },
    };
  }

  /**
   * 시스템 변수 생성
   * - 날짜, 시간 등 자동 치환되는 변수
   */
  private getSystemVariables(): Record<string, string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return {
      오늘날짜: `${year}-${month}-${day}`,
      오늘: `${year}년 ${month}월 ${day}일`,
      년도: String(year),
      월: month,
      일: day,
      시간: `${hours}:${minutes}`,
      시: hours,
      분: minutes,
      요일: ['일', '월', '화', '수', '목', '금', '토'][now.getDay()],
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

    // 한글 변수명도 지원 (유니코드)
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return variables[trimmedKey] !== undefined 
        ? variables[trimmedKey] 
        : match;
    });
  }
}











