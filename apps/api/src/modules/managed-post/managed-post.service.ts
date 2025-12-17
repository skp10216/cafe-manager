/**
 * ManagedPost 서비스
 * 동기화된 게시글 비즈니스 로직
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { JobService } from '../job/job.service';
import { ManagedPostQueryDto } from './dto/managed-post-query.dto';
import {
  PaginatedResponse,
  createPaginationMeta,
} from '@/common/dto/pagination.dto';
import { ManagedPost } from '@prisma/client';

@Injectable()
export class ManagedPostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService
  ) {}

  /**
   * 게시글 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(
    userId: string,
    query: ManagedPostQueryDto
  ): Promise<PaginatedResponse<ManagedPost>> {
    const { page = 1, limit = 20, cafeId, boardId, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(cafeId && { cafeId }),
      ...(boardId && { boardId }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.managedPost.findMany({
        where,
        orderBy: { createdAtRemote: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.managedPost.count({ where }),
    ]);

    return {
      data,
      meta: createPaginationMeta(page, limit, total),
    };
  }

  /**
   * 게시글 상세 조회
   */
  async findOne(id: string, userId: string) {
    const post = await this.prisma.managedPost.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    return post;
  }

  /**
   * "내가 쓴 글" 동기화 요청
   */
  async requestSync(userId: string) {
    // 동기화 Job 생성
    const job = await this.jobService.createJob({
      type: 'SYNC_POSTS',
      userId,
      payload: {},
    });

    return {
      message: '동기화 작업이 등록되었습니다',
      jobId: job.id,
    };
  }

  /**
   * 게시글 통계 조회
   */
  async getStats(userId: string) {
    const [totalCount, activeCount, deletedCount, cafeCounts] =
      await Promise.all([
        this.prisma.managedPost.count({ where: { userId } }),
        this.prisma.managedPost.count({
          where: { userId, status: 'ACTIVE' },
        }),
        this.prisma.managedPost.count({
          where: { userId, status: 'DELETED' },
        }),
        this.prisma.managedPost.groupBy({
          by: ['cafeId'],
          where: { userId, status: 'ACTIVE' },
          _count: { id: true },
        }),
      ]);

    return {
      total: totalCount,
      active: activeCount,
      deleted: deletedCount,
      byCafe: cafeCounts.map((item) => ({
        cafeId: item.cafeId,
        count: item._count.id,
      })),
    };
  }

  /**
   * 게시글 일괄 업서트 (Worker에서 호출)
   */
  async upsertPosts(
    userId: string,
    posts: Array<{
      cafeId: string;
      boardId: string;
      articleId: string;
      articleUrl: string;
      title: string;
      createdAtRemote?: Date;
    }>
  ) {
    const now = new Date();

    const operations = posts.map((post) =>
      this.prisma.managedPost.upsert({
        where: {
          cafeId_articleId: {
            cafeId: post.cafeId,
            articleId: post.articleId,
          },
        },
        create: {
          userId,
          cafeId: post.cafeId,
          boardId: post.boardId,
          articleId: post.articleId,
          articleUrl: post.articleUrl,
          title: post.title,
          createdAtRemote: post.createdAtRemote,
          lastSyncedAt: now,
          status: 'ACTIVE',
        },
        update: {
          title: post.title,
          lastSyncedAt: now,
          status: 'ACTIVE',
        },
      })
    );

    return this.prisma.$transaction(operations);
  }

  /**
   * 게시글 상태 업데이트 (삭제됨으로 표시)
   */
  async markAsDeleted(id: string) {
    return this.prisma.managedPost.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });
  }
}









