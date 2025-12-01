/**
 * Job Processor
 * BullMQ Job 타입별 처리 로직
 */

import { Job as BullJob } from 'bullmq';
import { PrismaClient, JobStatus } from '@prisma/client';
import { JobType } from '../constants';
import { createLogger } from '../utils/logger';
import { BrowserManager } from '../playwright/browser-manager';
import { NaverCafeClient } from '../playwright/naver-cafe-client';

const logger = createLogger('JobProcessor');

interface JobData {
  jobId: string;
  type: JobType;
  payload: Record<string, unknown>;
}

export class JobProcessor {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly browserManager: BrowserManager
  ) {}

  /**
   * Job 처리 메인 함수
   */
  async process(bullJob: BullJob<JobData>): Promise<void> {
    const { jobId, type, payload } = bullJob.data;

    // DB에서 Job 정보 조회
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // 상태를 PROCESSING으로 업데이트
    await this.updateJobStatus(jobId, 'PROCESSING', { startedAt: new Date() });
    await this.addLog(jobId, 'INFO', `Job 처리 시작: ${type}`);

    try {
      // 타입별 처리
      switch (type) {
        case 'INIT_SESSION':
          await this.handleInitSession(jobId, payload);
          break;
        case 'CREATE_POST':
          await this.handleCreatePost(jobId, payload);
          break;
        case 'SYNC_POSTS':
          await this.handleSyncPosts(jobId, payload);
          break;
        case 'DELETE_POST':
          await this.handleDeletePost(jobId, payload);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // 성공 처리
      await this.updateJobStatus(jobId, 'COMPLETED', { finishedAt: new Date() });
      await this.addLog(jobId, 'INFO', 'Job 처리 완료');
    } catch (error) {
      // 실패 처리
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateJobStatus(jobId, 'FAILED', {
        finishedAt: new Date(),
        errorMessage,
      });
      await this.addLog(jobId, 'ERROR', `Job 처리 실패: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * INIT_SESSION: 네이버 세션 초기화
   */
  private async handleInitSession(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { sessionId, profileDir } = payload as {
      sessionId: string;
      profileDir: string;
    };

    await this.addLog(jobId, 'INFO', `세션 초기화 시작: ${profileDir}`);

    // 브라우저 컨텍스트 생성
    const context = await this.browserManager.getContext(profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 로그인 상태 확인
      const isLoggedIn = await client.isLoggedIn();

      if (!isLoggedIn) {
        // 로그인 페이지로 이동
        await client.navigateToLogin();
        await this.addLog(jobId, 'INFO', '네이버 로그인 페이지로 이동. 수동 로그인 대기 중...');

        // 로그인 완료 대기 (최대 5분)
        const loginSuccess = await client.waitForLogin(300000);

        if (!loginSuccess) {
          // 세션 상태를 ERROR로 업데이트
          await this.prisma.naverSession.update({
            where: { id: sessionId },
            data: {
              status: 'ERROR',
              errorMessage: '로그인 시간 초과',
            },
          });
          throw new Error('네이버 로그인 시간 초과');
        }
      }

      // 컨텍스트 저장
      await this.browserManager.saveContext(profileDir);

      // 세션 상태를 ACTIVE로 업데이트
      await this.prisma.naverSession.update({
        where: { id: sessionId },
        data: {
          status: 'ACTIVE',
          lastVerifiedAt: new Date(),
          errorMessage: null,
        },
      });

      await this.addLog(jobId, 'INFO', '세션 초기화 완료');
    } finally {
      await client.close();
    }
  }

  /**
   * CREATE_POST: 게시글 작성
   */
  private async handleCreatePost(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { cafeId, boardId, title, content } = payload as {
      cafeId: string;
      boardId: string;
      title: string;
      content: string;
    };

    await this.addLog(jobId, 'INFO', `게시글 작성 시작: ${cafeId}/${boardId}`);

    // 작업 소유자의 활성 세션 찾기
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    const session = await this.prisma.naverSession.findFirst({
      where: {
        userId: job!.userId,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      throw new Error('활성화된 네이버 세션이 없습니다');
    }

    // 브라우저 컨텍스트 가져오기
    const context = await this.browserManager.getContext(session.profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 로그인 확인
      const isLoggedIn = await client.isLoggedIn();
      if (!isLoggedIn) {
        // 세션 만료 처리
        await this.prisma.naverSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
        throw new Error('네이버 세션이 만료되었습니다');
      }

      // 게시글 작성
      const articleUrl = await client.createPost(cafeId, boardId, title, content);

      if (!articleUrl) {
        // 스크린샷 저장
        await this.browserManager.saveScreenshot(session.profileDir, `create-post-error-${jobId}`);
        throw new Error('게시글 작성 실패');
      }

      await this.addLog(jobId, 'INFO', `게시글 작성 완료: ${articleUrl}`, {
        articleUrl,
      });
    } finally {
      await client.close();
    }
  }

  /**
   * SYNC_POSTS: 내가 쓴 글 동기화
   */
  private async handleSyncPosts(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { cafeId } = payload as { cafeId?: string };

    await this.addLog(jobId, 'INFO', '게시글 동기화 시작');

    // 작업 소유자의 활성 세션 찾기
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    const session = await this.prisma.naverSession.findFirst({
      where: {
        userId: job!.userId,
        status: 'ACTIVE',
      },
    });

    if (!session) {
      throw new Error('활성화된 네이버 세션이 없습니다');
    }

    const context = await this.browserManager.getContext(session.profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 특정 카페 또는 모든 카페 동기화
      // (현재는 단일 카페만 지원)
      if (cafeId) {
        const posts = await client.syncMyPosts(cafeId);

        // DB에 업서트
        const now = new Date();
        for (const post of posts) {
          await this.prisma.managedPost.upsert({
            where: {
              cafeId_articleId: {
                cafeId: post.cafeId,
                articleId: post.articleId,
              },
            },
            create: {
              userId: job!.userId,
              cafeId: post.cafeId,
              boardId: post.boardId || '',
              articleId: post.articleId,
              articleUrl: post.articleUrl,
              title: post.title,
              lastSyncedAt: now,
              status: 'ACTIVE',
            },
            update: {
              title: post.title,
              lastSyncedAt: now,
              status: 'ACTIVE',
            },
          });
        }

        await this.addLog(jobId, 'INFO', `동기화 완료: ${posts.length}개 게시글`);
      }
    } finally {
      await client.close();
    }
  }

  /**
   * DELETE_POST: 게시글 삭제
   * (2단계에서 구현 예정)
   */
  private async handleDeletePost(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.addLog(jobId, 'WARN', '게시글 삭제 기능은 아직 구현되지 않았습니다');
    // TODO: 2단계에서 구현
  }

  /**
   * Job 상태 업데이트
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    options?: {
      startedAt?: Date;
      finishedAt?: Date;
      errorMessage?: string;
    }
  ) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        startedAt: options?.startedAt,
        finishedAt: options?.finishedAt,
        errorMessage: options?.errorMessage,
        attempts: status === 'PROCESSING' ? { increment: 1 } : undefined,
      },
    });
  }

  /**
   * Job 로그 추가
   */
  private async addLog(
    jobId: string,
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    meta?: Record<string, unknown>
  ) {
    await this.prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
        meta: meta || undefined,
      },
    });

    // 콘솔에도 출력
    const logFn = level === 'ERROR' ? logger.error : level === 'WARN' ? logger.warn : logger.info;
    logFn.call(logger, `[Job:${jobId}] ${message}`);
  }
}

