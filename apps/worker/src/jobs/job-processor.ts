/**
 * Job Processor
 * BullMQ Job 타입별 처리 로직
 *
 * NaverAccount 기반 로그인 지원
 */

import { Job as BullJob } from 'bullmq';
import { PrismaClient, JobStatus, Prisma } from '@prisma/client';
import { JobType } from '../constants';
import { createLogger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
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
        case 'VERIFY_SESSION':
          await this.handleVerifySession(jobId, payload);
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

      // ScheduleRun 진행률 업데이트
      if (job.scheduleRunId) {
        await this.updateScheduleRunProgress(job.scheduleRunId, 'completed');
      }
    } catch (error) {
      // 실패 처리
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.updateJobStatus(jobId, 'FAILED', {
        finishedAt: new Date(),
        errorMessage,
      });
      await this.addLog(jobId, 'ERROR', `Job 처리 실패: ${errorMessage}`);

      // ScheduleRun 진행률 업데이트
      if (job.scheduleRunId) {
        await this.updateScheduleRunProgress(job.scheduleRunId, 'failed');
      }

      throw error;
    }
  }

  /**
   * INIT_SESSION: 네이버 세션 초기화
   * NaverAccount 정보를 사용하여 자동 로그인 시도
   */
  private async handleInitSession(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { naverAccountId, naverSessionId, profileDir, isReconnect } = payload as {
      naverAccountId: string;
      naverSessionId: string;
      profileDir: string;
      isReconnect?: boolean;
    };

    await this.addLog(
      jobId,
      'INFO',
      `세션 초기화 시작: sessionId=${naverSessionId}, accountId=${naverAccountId}, reconnect=${!!isReconnect}`
    );

    // NaverAccount 조회
    const account = await this.prisma.naverAccount.findUnique({
      where: { id: naverAccountId },
    });

    if (!account) {
      await this.updateSessionError(naverSessionId, '네이버 계정을 찾을 수 없습니다');
      throw new Error(`NaverAccount not found: ${naverAccountId}`);
    }

    // 비밀번호 복호화
    let password: string;
    try {
      password = decrypt(account.passwordEncrypted);
    } catch (error) {
      const errMsg = '비밀번호 복호화 실패';
      await this.updateSessionError(naverSessionId, errMsg);
      await this.updateAccountLoginStatus(naverAccountId, 'LOGIN_FAILED', errMsg);
      throw new Error(errMsg);
    }

    // 브라우저 컨텍스트 생성
    const context = await this.browserManager.getContext(profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 로그인 상태 확인
      const isLoggedIn = await client.isLoggedIn();

      if (!isLoggedIn) {
        await this.addLog(jobId, 'INFO', `네이버 자동 로그인 시도: ${account.loginId}`);

        // 자동 로그인 시도
        const loginResult = await client.login(account.loginId, password);

        if (!loginResult.success) {
          const errorMsg = loginResult.error || '로그인 실패';
          await this.addLog(jobId, 'WARN', `자동 로그인 실패: ${errorMsg}`);
          // 원인 파악을 위해 실패 시점 스크린샷을 남긴다.
          await this.browserManager.saveScreenshot(profileDir, `init-session-login-failed-${jobId}`);

          // CAPTCHA/2FA 등으로 자동 로그인 실패 시 수동 로그인 대기
          if (
            errorMsg.includes('CAPTCHA') ||
            errorMsg.includes('2단계 인증') ||
            errorMsg.includes('수동 로그인')
          ) {
            await this.addLog(
              jobId,
              'INFO',
              '수동 로그인이 필요합니다. 브라우저에서 로그인을 완료해주세요. (5분 대기)'
            );

            // UI에서 "연동 진행 중..."만 보이지 않도록, 진행 상태 메시지를 세션에 기록한다.
            // (상태는 PENDING 유지)
            await this.prisma.naverSession.update({
              where: { id: naverSessionId },
              data: {
                status: 'PENDING',
                errorMessage:
                  '수동 로그인이 필요합니다. Worker 브라우저에서 네이버 로그인(추가 인증/보안 화면 포함)을 완료해주세요.',
              },
            });

            // 로그인 페이지로 이동 후 수동 로그인 대기
            await client.navigateToLogin();
            const manualLoginSuccess = await client.waitForLogin(300000); // 5분 대기

            if (!manualLoginSuccess) {
              await this.updateSessionError(naverSessionId, '수동 로그인 시간 초과');
              await this.updateAccountLoginStatus(
                naverAccountId,
                'LOGIN_FAILED',
                '수동 로그인 시간 초과'
              );
              throw new Error('네이버 수동 로그인 시간 초과');
            }
          } else {
            // 비밀번호 오류 등 일반적인 로그인 실패
            await this.updateSessionError(naverSessionId, errorMsg);
            await this.updateAccountLoginStatus(naverAccountId, 'LOGIN_FAILED', errorMsg);
            throw new Error(`네이버 로그인 실패: ${errorMsg}`);
          }
        }

        await this.addLog(jobId, 'INFO', '네이버 로그인 성공');
      } else {
        await this.addLog(jobId, 'INFO', '이미 로그인되어 있습니다');
      }

      // 컨텍스트 저장 (세션 유지)
      await this.browserManager.saveContext(profileDir);

      // 프로필(닉네임) 가져오기
      let nickname: string | null = null;
      try {
        const profile = await client.getProfile();
        nickname = profile?.nickname || null;
        if (nickname) {
          await this.addLog(jobId, 'INFO', `프로필 확인: 닉네임=${nickname}`);
        }
      } catch (profileError) {
        await this.addLog(jobId, 'WARN', '프로필 정보 가져오기 실패 (세션은 유효)');
      }

      // 세션 상태를 ACTIVE로 업데이트 (닉네임 포함)
      await this.prisma.naverSession.update({
        where: { id: naverSessionId },
        data: {
          status: 'ACTIVE',
          lastVerifiedAt: new Date(),
          errorMessage: null,
          naverNickname: nickname,
        },
      });

      // 계정 로그인 상태 업데이트
      await this.updateAccountLoginStatus(naverAccountId, 'ACTIVE', '로그인 성공');

      await this.addLog(jobId, 'INFO', '세션 초기화 완료');
    } finally {
      await client.close();
    }
  }

  /**
   * VERIFY_SESSION: 세션 검증 (실제 로그인 상태 + 닉네임 확인)
   */
  private async handleVerifySession(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { naverSessionId } = payload as {
      naverSessionId: string;
    };

    await this.addLog(jobId, 'INFO', `세션 검증 시작: sessionId=${naverSessionId}`);

    // 세션 조회
    const session = await this.prisma.naverSession.findUnique({
      where: { id: naverSessionId },
      include: { naverAccount: true },
    });

    if (!session) {
      throw new Error(`Session not found: ${naverSessionId}`);
    }

    // 브라우저 컨텍스트 생성
    const context = await this.browserManager.getContext(session.profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 세션 검증 수행
      let result = await client.verifySession();

      if (!result.isValid) {
        // ✅ 자동 복구: 세션이 로그아웃된 경우, 저장된 계정 자격증명으로 1회 재로그인 시도
        // - Worker 재시작/쿠키 만료/네이버 정책 변경 등으로 state.json이 무효화될 수 있음
        if (result.error?.includes('로그인되어 있지 않습니다') && session.naverAccount) {
          await this.addLog(jobId, 'WARN', '세션이 로그아웃 상태입니다. 자동 재로그인을 시도합니다.');

          try {
            const password = decrypt(session.naverAccount.passwordEncrypted);
            const loginResult = await client.login(session.naverAccount.loginId, password);

            if (!loginResult.success) {
              const errorMsg = loginResult.error || '로그인 실패';

              // CAPTCHA/2FA 등으로 자동 로그인 실패 시 수동 로그인 대기(VERIFY에서도 동일하게 지원)
              if (
                errorMsg.includes('CAPTCHA') ||
                errorMsg.includes('2단계 인증') ||
                errorMsg.includes('수동 로그인')
              ) {
                await this.addLog(
                  jobId,
                  'INFO',
                  '수동 로그인이 필요합니다. 브라우저에서 로그인을 완료해주세요. (5분 대기)'
                );
                await client.navigateToLogin();
                const manualLoginSuccess = await client.waitForLogin(300000);
                if (!manualLoginSuccess) {
                  throw new Error('수동 로그인 시간 초과');
                }
              } else {
                throw new Error(errorMsg);
              }
            }

            // 로그인 성공 후 컨텍스트 저장 + 재검증
            await this.browserManager.saveContext(session.profileDir);
            result = await client.verifySession();
          } catch (reloginErr) {
            const reloginMsg =
              reloginErr instanceof Error ? reloginErr.message : String(reloginErr);
            await this.addLog(jobId, 'WARN', `자동 재로그인 실패: ${reloginMsg}`);
          }
        }

        // 세션 만료/오류 처리
        if (!result.isValid) {
          await this.prisma.naverSession.update({
            where: { id: naverSessionId },
            data: {
              status: 'EXPIRED',
              errorMessage: result.error || '세션이 만료되었습니다',
            },
          });
          await this.addLog(jobId, 'WARN', `세션 검증 실패: ${result.error}`);
          await this.browserManager.saveScreenshot(session.profileDir, `verify-session-invalid-${jobId}`);
          throw new Error(result.error || '세션 검증 실패');
        }
      }

      // 성공: 세션 상태 및 닉네임 업데이트
      await this.prisma.naverSession.update({
        where: { id: naverSessionId },
        data: {
          status: 'ACTIVE',
          lastVerifiedAt: new Date(),
          errorMessage: null,
          naverNickname: result.profile?.nickname || null,
        },
      });

      // 닉네임을 못 가져와도 로그인 자체는 유효할 수 있다.
      // 다만, UI/운영에서 원인 파악이 가능하도록 스크린샷과 경고 로그를 남긴다.
      if (!result.profile?.nickname) {
        await this.addLog(
          jobId,
          'WARN',
          '세션은 유효하지만 네이버 닉네임을 가져오지 못했습니다. (네이버 UI 변경/권한/페이지 구조 변화 가능)'
        );
        await this.browserManager.saveScreenshot(session.profileDir, `verify-session-no-nickname-${jobId}`);
      }

      // 컨텍스트 저장
      await this.browserManager.saveContext(session.profileDir);

      await this.addLog(
        jobId,
        'INFO',
        `세션 검증 완료: 닉네임=${result.profile?.nickname || '(알 수 없음)'}`
      );
    } finally {
      await client.close();
    }
  }

  /**
   * CREATE_POST: 게시글 작성 (이미지 첨부 포함)
   */
  private async handleCreatePost(
    jobId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const { 
      cafeId, 
      boardId, 
      title, 
      content, 
      imagePaths = [],
      price,
      tradeMethod,
      tradeLocation,
      naverAccountId,
      templateId,
    } = payload as {
      cafeId: string;
      boardId: string;
      title: string;
      content: string;
      imagePaths?: string[];
      price?: number;
      tradeMethod?: 'DIRECT' | 'DELIVERY' | 'BOTH';
      tradeLocation?: string;
      naverAccountId?: string;
      templateId?: string;
    };

    await this.addLog(jobId, 'INFO', `게시글 작성 시작: ${cafeId}/${boardId}`, {
      title,
      imageCount: imagePaths.length,
      hasPrice: !!price,
    });

    // 작업 소유자 및 활성 세션 찾기
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    if (!job) {
      throw new Error('Job을 찾을 수 없습니다');
    }

    // naverAccountId가 지정되면 해당 계정의 세션 사용, 없으면 사용자의 아무 활성 세션
    let session;
    if (naverAccountId) {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccountId,
          status: 'ACTIVE',
        },
        include: {
          naverAccount: true,
        },
      });
    } else {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccount: {
            userId: job.userId,
          },
          status: 'ACTIVE',
        },
        include: {
          naverAccount: true,
        },
      });
    }

    if (!session) {
      throw new Error('활성화된 네이버 세션이 없습니다. 네이버 계정을 먼저 연동해주세요.');
    }

    await this.addLog(jobId, 'INFO', `세션 사용: ${session.naverAccount?.loginId || session.id}`);

    // 브라우저 컨텍스트 가져오기
    const context = await this.browserManager.getContext(session.profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 1. 로그인 상태 확인
      await this.addLog(jobId, 'INFO', '로그인 상태 확인 중...');
      const isLoggedIn = await client.isLoggedIn();
      
      if (!isLoggedIn) {
        await this.addLog(jobId, 'WARN', '세션이 만료됨. 자동 재로그인 시도...');
        
        // 자동 재로그인 시도
        if (session.naverAccount) {
          const password = decrypt(session.naverAccount.passwordEncrypted);
          const loginResult = await client.login(session.naverAccount.loginId, password);
          
          if (!loginResult.success) {
            // 세션 만료 처리
            await this.prisma.naverSession.update({
              where: { id: session.id },
              data: { status: 'EXPIRED', errorMessage: loginResult.error },
            });
            throw new Error(`재로그인 실패: ${loginResult.error}`);
          }
          
          await this.addLog(jobId, 'INFO', '재로그인 성공');
          await this.browserManager.saveContext(session.profileDir);
        } else {
          await this.prisma.naverSession.update({
            where: { id: session.id },
            data: { status: 'EXPIRED' },
          });
          throw new Error('네이버 세션이 만료되었습니다');
        }
      }

      // 2. 게시글 작성
      await this.addLog(jobId, 'INFO', '게시글 작성 중...');
      
      const result = await client.createPost({
        cafeId,
        boardId,
        title,
        content,
        imagePaths,
        price,
        tradeMethod,
        tradeLocation,
      });

      if (!result.success) {
        // 실패 시 스크린샷 저장
        await this.browserManager.saveScreenshot(
          session.profileDir, 
          `create-post-error-${jobId}`
        );
        throw new Error(result.error || '게시글 작성 실패');
      }

      // 3. 성공 로그 및 ManagedPost 등록
      await this.addLog(jobId, 'INFO', `게시글 작성 완료: ${result.articleUrl}`, {
        articleUrl: result.articleUrl,
        articleId: result.articleId,
        uploadedImages: result.uploadedImages,
      });

      // ManagedPost에 등록 (게시글 관리 목적)
      if (result.articleId) {
        try {
          await this.prisma.managedPost.upsert({
            where: {
              cafeId_articleId: {
                cafeId,
                articleId: result.articleId,
              },
            },
            create: {
              userId: job.userId,
              cafeId,
              boardId,
              articleId: result.articleId,
              articleUrl: result.articleUrl || '',
              title,
              status: 'ACTIVE',
              lastSyncedAt: new Date(),
            },
            update: {
              title,
              status: 'ACTIVE',
              lastSyncedAt: new Date(),
            },
          });
          await this.addLog(jobId, 'INFO', 'ManagedPost 등록 완료');
        } catch (err) {
          // ManagedPost 등록 실패는 치명적이지 않음
          await this.addLog(jobId, 'WARN', 'ManagedPost 등록 실패 (무시됨)');
        }
      }

      // 4. 브라우저 컨텍스트 저장 (세션 유지)
      await this.browserManager.saveContext(session.profileDir);

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
    const { cafeId, naverAccountId } = payload as {
      cafeId?: string;
      naverAccountId?: string;
    };

    await this.addLog(jobId, 'INFO', '게시글 동기화 시작');

    // 작업 소유자 및 활성 세션 찾기
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    // naverAccountId가 지정되면 해당 계정의 세션 사용
    let session;
    if (naverAccountId) {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccountId,
          status: 'ACTIVE',
        },
      });
    } else {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccount: {
            userId: job!.userId,
          },
          status: 'ACTIVE',
        },
      });
    }

    if (!session) {
      throw new Error('활성화된 네이버 세션이 없습니다');
    }

    const context = await this.browserManager.getContext(session.profileDir);
    const client = new NaverCafeClient(context);

    try {
      // 특정 카페 또는 모든 카페 동기화
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
    _payload: Record<string, unknown>
  ): Promise<void> {
    await this.addLog(jobId, 'WARN', '게시글 삭제 기능은 아직 구현되지 않았습니다');
    // TODO: 2단계에서 구현
  }

  /**
   * 세션 에러 업데이트
   */
  private async updateSessionError(sessionId: string, errorMessage: string) {
    await this.prisma.naverSession.update({
      where: { id: sessionId },
      data: {
        status: 'ERROR',
        errorMessage,
      },
    });
  }

  /**
   * NaverAccount 로그인 상태 업데이트
   */
  private async updateAccountLoginStatus(
    accountId: string,
    status: 'ACTIVE' | 'LOGIN_FAILED',
    message: string
  ) {
    await this.prisma.naverAccount.update({
      where: { id: accountId },
      data: {
        status,
        lastLoginAt: new Date(),
        lastLoginStatus: status === 'ACTIVE' ? 'SUCCESS' : 'FAILED',
        lastLoginError: status === 'LOGIN_FAILED' ? message : null,
      },
    });
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
    meta?: Prisma.InputJsonValue
  ) {
    await this.prisma.jobLog.create({
      data: {
        jobId,
        level,
        message,
        meta: meta ?? undefined,
      },
    });

    // 콘솔에도 출력
    logger.log(level.toLowerCase(), `[Job:${jobId}] ${message}`);
  }

  /**
   * ScheduleRun 진행률 업데이트
   */
  private async updateScheduleRunProgress(
    scheduleRunId: string,
    jobStatus: 'completed' | 'failed'
  ) {
    try {
      const run = await this.prisma.scheduleRun.findUnique({
        where: { id: scheduleRunId },
      });

      if (!run) {
        logger.warn(`ScheduleRun not found: ${scheduleRunId}`);
        return;
      }

      const updates: any = {
        completedJobs:
          jobStatus === 'completed' ? run.completedJobs + 1 : run.completedJobs,
        failedJobs: jobStatus === 'failed' ? run.failedJobs + 1 : run.failedJobs,
      };

      // 첫 Job 시작 시각 기록
      if (!run.startedAt) {
        updates.startedAt = new Date();
      }

      // 모든 Job 완료 여부 확인
      if (updates.completedJobs + updates.failedJobs >= run.totalJobs) {
        updates.status = updates.failedJobs === 0 ? 'COMPLETED' : 'FAILED';
        updates.finishedAt = new Date();
      }

      await this.prisma.scheduleRun.update({
        where: { id: scheduleRunId },
        data: updates,
      });

      logger.debug(
        `ScheduleRun ${scheduleRunId} updated: ` +
        `${updates.completedJobs}/${run.totalJobs} completed, ` +
        `${updates.failedJobs} failed`
      );
    } catch (error) {
      logger.error(`Failed to update ScheduleRun progress: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
