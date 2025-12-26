/**
 * Job Processor
 * BullMQ Job 타입별 처리 로직
 *
 * 운영형 SaaS 고도화:
 * - 표준 ErrorCode 체계
 * - 디버그 모드 (headed + 아티팩트 저장)
 * - 세션 상태 자동 전환
 */

import { Job as BullJob } from 'bullmq';
import { PrismaClient, JobStatus, Prisma, ErrorCode, RunMode, SessionStatus } from '@prisma/client';
import { JobType } from '../constants';
import { createLogger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
import { BrowserManager } from '../playwright/browser-manager';
import { NaverCafeClient } from '../playwright/naver-cafe-client';
import * as path from 'path';
import * as fs from 'fs';

const logger = createLogger('JobProcessor');

/** 재시도 가능한 에러 코드 */
const RETRYABLE_ERROR_CODES: ErrorCode[] = [
  'RATE_LIMIT',
  'UPLOAD_FAILED',
  'NETWORK_ERROR',
  'TIMEOUT',
  'BROWSER_ERROR',
];

/** 세션 상태 전환이 필요한 에러 코드 */
const SESSION_TRANSITION_ERROR_CODES: ErrorCode[] = [
  'AUTH_EXPIRED',
  'CHALLENGE_REQUIRED',
  'LOGIN_FAILED',
];

interface JobData {
  jobId: string;
  type: JobType;
  payload: Record<string, unknown>;
}

export class JobProcessor {
  private readonly artifactsDir: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly browserManager: BrowserManager
  ) {
    // 아티팩트 저장 디렉토리
    this.artifactsDir = path.join(process.cwd(), 'artifacts');
    if (!fs.existsSync(this.artifactsDir)) {
      fs.mkdirSync(this.artifactsDir, { recursive: true });
    }
  }

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

    // 실행 모드 결정 (DB에서 가져오거나 기본값)
    const runMode: RunMode = job.runMode ?? 'HEADLESS';

    // 상태를 PROCESSING으로 업데이트
    await this.updateJobStatus(jobId, 'PROCESSING', { startedAt: new Date() });
    await this.addLog(jobId, 'INFO', `Job 처리 시작: ${type} (mode=${runMode})`);

    try {
      // 타입별 처리
      switch (type) {
        case 'INIT_SESSION':
          await this.handleInitSession(jobId, payload, runMode);
          break;
        case 'VERIFY_SESSION':
          await this.handleVerifySession(jobId, payload, runMode);
          break;
        case 'CREATE_POST':
          await this.handleCreatePost(jobId, payload, runMode);
          break;
        case 'SYNC_POSTS':
          await this.handleSyncPosts(jobId, payload, runMode);
          break;
        case 'DELETE_POST':
          await this.handleDeletePost(jobId, payload, runMode);
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
      // 에러 코드 분류
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = this.classifyErrorCode(errorMessage);

      // 실패 처리
      await this.updateJobStatus(jobId, 'FAILED', {
        finishedAt: new Date(),
        errorMessage,
        errorCode,
      });
      await this.addLog(jobId, 'ERROR', `Job 처리 실패: ${errorMessage}`, {
        errorCode,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 디버그 모드: 아티팩트 저장
      if (runMode === 'DEBUG') {
        await this.saveErrorArtifacts(jobId, job.userId);
      }

      // 세션 상태 전환이 필요한 에러인 경우
      if (SESSION_TRANSITION_ERROR_CODES.includes(errorCode)) {
        await this.transitionSessionStatus(job.userId, errorCode);
      }

      // ScheduleRun 진행률 업데이트
      if (job.scheduleRunId) {
        await this.updateScheduleRunProgress(job.scheduleRunId, 'failed');
      }

      // 재시도 가능한 에러인 경우 예외를 다시 던져서 BullMQ가 재시도하도록 함
      if (RETRYABLE_ERROR_CODES.includes(errorCode) && job.attempts < job.maxAttempts) {
        throw error;
      }
    }
  }

  /**
   * 에러 메시지에서 에러 코드 분류
   */
  private classifyErrorCode(errorMessage: string): ErrorCode {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('로그인') && (msg.includes('만료') || msg.includes('expired'))) {
      return 'AUTH_EXPIRED';
    }
    if (msg.includes('captcha') || msg.includes('2단계') || msg.includes('추가 인증')) {
      return 'CHALLENGE_REQUIRED';
    }
    if (msg.includes('로그인 실패') || msg.includes('login failed')) {
      return 'LOGIN_FAILED';
    }
    if (msg.includes('권한') || msg.includes('permission')) {
      return 'PERMISSION_DENIED';
    }
    if (msg.includes('카페') && (msg.includes('없') || msg.includes('not found'))) {
      return 'CAFE_NOT_FOUND';
    }
    if (msg.includes('rate') || msg.includes('제한') || msg.includes('too many')) {
      return 'RATE_LIMIT';
    }
    if (msg.includes('ui') && msg.includes('변경')) {
      return 'UI_CHANGED';
    }
    if (msg.includes('업로드') || msg.includes('upload')) {
      return 'UPLOAD_FAILED';
    }
    if (msg.includes('network') || msg.includes('네트워크') || msg.includes('연결')) {
      return 'NETWORK_ERROR';
    }
    if (msg.includes('timeout') || msg.includes('시간 초과')) {
      return 'TIMEOUT';
    }
    if (msg.includes('browser') || msg.includes('브라우저')) {
      return 'BROWSER_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * 세션 상태 전환
   */
  private async transitionSessionStatus(userId: string, errorCode: ErrorCode) {
    try {
      let newStatus: SessionStatus;

      switch (errorCode) {
        case 'AUTH_EXPIRED':
          newStatus = 'EXPIRED';
          break;
        case 'CHALLENGE_REQUIRED':
          newStatus = 'CHALLENGE_REQUIRED';
          break;
        case 'LOGIN_FAILED':
          newStatus = 'ERROR';
          break;
        default:
          return;
      }

      // 사용자의 모든 활성 세션 상태 전환
      await this.prisma.naverSession.updateMany({
        where: {
          naverAccount: { userId },
          status: { in: ['HEALTHY', 'EXPIRING', 'PENDING'] },
        },
        data: {
          status: newStatus,
          errorCode,
          errorMessage: `자동 전환: ${errorCode}`,
        },
      });

      logger.info(`세션 상태 전환: userId=${userId}, newStatus=${newStatus}`);
    } catch (error) {
      logger.error(`세션 상태 전환 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 에러 아티팩트 저장 (디버그 모드)
   */
  private async saveErrorArtifacts(jobId: string, _userId: string) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(this.artifactsDir, `${jobId}-${timestamp}.png`);
      const htmlPath = path.join(this.artifactsDir, `${jobId}-${timestamp}.html`);

      // 스크린샷은 BrowserManager에서 저장
      // (실제 구현에서는 현재 열린 페이지에서 캡처)

      // Job에 아티팩트 경로 저장
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          screenshotPath,
          htmlPath,
        },
      });

      logger.debug(`아티팩트 저장: ${screenshotPath}`);
    } catch (error) {
      logger.error(`아티팩트 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * INIT_SESSION: 네이버 세션 초기화
   */
  private async handleInitSession(
    jobId: string,
    payload: Record<string, unknown>,
    runMode: RunMode
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
      await this.updateSessionError(naverSessionId, '네이버 계정을 찾을 수 없습니다', 'AUTH_INVALID');
      throw new Error(`NaverAccount not found: ${naverAccountId}`);
    }

    // 비밀번호 복호화
    let password: string;
    try {
      password = decrypt(account.passwordEncrypted);
    } catch (error) {
      const errMsg = '비밀번호 복호화 실패';
      await this.updateSessionError(naverSessionId, errMsg, 'AUTH_INVALID');
      await this.updateAccountLoginStatus(naverAccountId, 'LOGIN_FAILED', errMsg);
      throw new Error(errMsg);
    }

    // 브라우저 컨텍스트 생성 (디버그 모드면 headed)
    const context = await this.browserManager.getContext(profileDir, runMode === 'DEBUG');
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

          // 디버그 모드: 스크린샷 저장
          if (runMode === 'DEBUG') {
            await this.browserManager.saveScreenshot(profileDir, `init-session-login-failed-${jobId}`);
          }

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

            await this.prisma.naverSession.update({
              where: { id: naverSessionId },
              data: {
                status: 'CHALLENGE_REQUIRED',
                errorCode: 'CHALLENGE_REQUIRED',
                errorMessage:
                  '수동 로그인이 필요합니다. Worker 브라우저에서 네이버 로그인을 완료해주세요.',
              },
            });

            // 로그인 페이지로 이동 후 수동 로그인 대기
            await client.navigateToLogin();
            const manualLoginSuccess = await client.waitForLogin(300000);

            if (!manualLoginSuccess) {
              await this.updateSessionError(naverSessionId, '수동 로그인 시간 초과', 'TIMEOUT');
              await this.updateAccountLoginStatus(naverAccountId, 'LOGIN_FAILED', '수동 로그인 시간 초과');
              throw new Error('네이버 수동 로그인 시간 초과');
            }
          } else {
            // 비밀번호 오류 등 일반적인 로그인 실패
            await this.updateSessionError(naverSessionId, errorMsg, 'LOGIN_FAILED');
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

      // 세션 상태를 HEALTHY로 업데이트
      await this.prisma.naverSession.update({
        where: { id: naverSessionId },
        data: {
          status: 'HEALTHY',
          lastVerifiedAt: new Date(),
          lastCheckedAt: new Date(),
          errorMessage: null,
          errorCode: null,
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
   * VERIFY_SESSION: 세션 검증
   */
  private async handleVerifySession(
    jobId: string,
    payload: Record<string, unknown>,
    runMode: RunMode
  ): Promise<void> {
    const { naverSessionId } = payload as { naverSessionId: string };

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
    const context = await this.browserManager.getContext(session.profileDir, runMode === 'DEBUG');
    const client = new NaverCafeClient(context);

    try {
      let result = await client.verifySession();

      if (!result.isValid) {
        // 자동 복구 시도
        if (result.error?.includes('로그인되어 있지 않습니다') && session.naverAccount) {
          await this.addLog(jobId, 'WARN', '세션이 로그아웃 상태입니다. 자동 재로그인을 시도합니다.');

          try {
            const password = decrypt(session.naverAccount.passwordEncrypted);
            const loginResult = await client.login(session.naverAccount.loginId, password);

            if (!loginResult.success) {
              const errorMsg = loginResult.error || '로그인 실패';

              if (
                errorMsg.includes('CAPTCHA') ||
                errorMsg.includes('2단계 인증') ||
                errorMsg.includes('수동 로그인')
              ) {
                await this.addLog(jobId, 'INFO', '수동 로그인이 필요합니다.');
                await client.navigateToLogin();
                const manualLoginSuccess = await client.waitForLogin(300000);
                if (!manualLoginSuccess) {
                  throw new Error('수동 로그인 시간 초과');
                }
              } else {
                throw new Error(errorMsg);
              }
            }

            await this.browserManager.saveContext(session.profileDir);
            result = await client.verifySession();
          } catch (reloginErr) {
            const reloginMsg = reloginErr instanceof Error ? reloginErr.message : String(reloginErr);
            await this.addLog(jobId, 'WARN', `자동 재로그인 실패: ${reloginMsg}`);
          }
        }

        if (!result.isValid) {
          await this.prisma.naverSession.update({
            where: { id: naverSessionId },
            data: {
              status: 'EXPIRED',
              errorCode: 'AUTH_EXPIRED',
              errorMessage: result.error || '세션이 만료되었습니다',
            },
          });
          await this.addLog(jobId, 'WARN', `세션 검증 실패: ${result.error}`);

          if (runMode === 'DEBUG') {
            await this.browserManager.saveScreenshot(session.profileDir, `verify-session-invalid-${jobId}`);
          }

          throw new Error(result.error || '세션 검증 실패');
        }
      }

      // 성공: 세션 상태 업데이트
      await this.prisma.naverSession.update({
        where: { id: naverSessionId },
        data: {
          status: 'HEALTHY',
          lastVerifiedAt: new Date(),
          lastCheckedAt: new Date(),
          errorMessage: null,
          errorCode: null,
          naverNickname: result.profile?.nickname || null,
        },
      });

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
   * CREATE_POST: 게시글 작성
   */
  private async handleCreatePost(
    jobId: string,
    payload: Record<string, unknown>,
    runMode: RunMode
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
    };

    await this.addLog(jobId, 'INFO', `게시글 작성 시작: ${cafeId}/${boardId}`, {
      title,
      imageCount: imagePaths.length,
      hasPrice: !!price,
      runMode,
    });

    // 작업 소유자 및 활성 세션 찾기
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    if (!job) {
      throw new Error('Job을 찾을 수 없습니다');
    }

    // 세션 찾기
    let session;
    if (naverAccountId) {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccountId,
          status: { in: ['HEALTHY', 'EXPIRING'] },
        },
        include: { naverAccount: true },
      });
    } else {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccount: { userId: job.userId },
          status: { in: ['HEALTHY', 'EXPIRING'] },
        },
        include: { naverAccount: true },
      });
    }

    if (!session) {
      throw new Error('활성화된 네이버 세션이 없습니다. 네이버 계정을 먼저 연동해주세요.');
    }

    await this.addLog(jobId, 'INFO', `세션 사용: ${session.naverAccount?.loginId || session.id}`);

    // 브라우저 컨텍스트 가져오기
    const context = await this.browserManager.getContext(session.profileDir, runMode === 'DEBUG');
    const client = new NaverCafeClient(context);

    try {
      // 1. 로그인 상태 확인
      await this.addLog(jobId, 'INFO', '로그인 상태 확인 중...');
      const isLoggedIn = await client.isLoggedIn();

      if (!isLoggedIn) {
        await this.addLog(jobId, 'WARN', '세션이 만료됨. 자동 재로그인 시도...');

        if (session.naverAccount) {
          const password = decrypt(session.naverAccount.passwordEncrypted);
          const loginResult = await client.login(session.naverAccount.loginId, password);

          if (!loginResult.success) {
            await this.prisma.naverSession.update({
              where: { id: session.id },
              data: {
                status: 'EXPIRED',
                errorCode: 'AUTH_EXPIRED',
                errorMessage: loginResult.error,
              },
            });
            throw new Error(`재로그인 실패: ${loginResult.error}`);
          }

          await this.addLog(jobId, 'INFO', '재로그인 성공');
          await this.browserManager.saveContext(session.profileDir);
        } else {
          await this.prisma.naverSession.update({
            where: { id: session.id },
            data: { status: 'EXPIRED', errorCode: 'AUTH_EXPIRED' },
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
        // 실패 시 스크린샷 저장 (항상)
        await this.browserManager.saveScreenshot(session.profileDir, `create-post-error-${jobId}`);
        throw new Error(result.error || '게시글 작성 실패');
      }

      // 3. 성공 로그
      await this.addLog(jobId, 'INFO', `게시글 작성 완료: ${result.articleUrl}`, {
        articleUrl: result.articleUrl,
        articleId: result.articleId,
        uploadedImages: result.uploadedImages,
      });

      // Job payload에 결과 저장
      await this.prisma.job.update({
        where: { id: jobId },
        data: {
          payload: {
            ...(payload as object),
            resultUrl: result.articleUrl,
            resultArticleId: result.articleId,
          } as Prisma.InputJsonValue,
        },
      });

      // ManagedPost에 등록
      if (result.articleId) {
        try {
          await this.prisma.managedPost.upsert({
            where: {
              cafeId_articleId: { cafeId, articleId: result.articleId },
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
          await this.addLog(jobId, 'WARN', 'ManagedPost 등록 실패 (무시됨)');
        }
      }

      // 4. 브라우저 컨텍스트 저장
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
    payload: Record<string, unknown>,
    runMode: RunMode
  ): Promise<void> {
    const { cafeId, naverAccountId } = payload as {
      cafeId?: string;
      naverAccountId?: string;
    };

    await this.addLog(jobId, 'INFO', '게시글 동기화 시작');

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    let session;
    if (naverAccountId) {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccountId,
          status: { in: ['HEALTHY', 'EXPIRING'] },
        },
      });
    } else {
      session = await this.prisma.naverSession.findFirst({
        where: {
          naverAccount: { userId: job!.userId },
          status: { in: ['HEALTHY', 'EXPIRING'] },
        },
      });
    }

    if (!session) {
      throw new Error('활성화된 네이버 세션이 없습니다');
    }

    const context = await this.browserManager.getContext(session.profileDir, runMode === 'DEBUG');
    const client = new NaverCafeClient(context);

    try {
      if (cafeId) {
        const posts = await client.syncMyPosts(cafeId);

        const now = new Date();
        for (const post of posts) {
          await this.prisma.managedPost.upsert({
            where: {
              cafeId_articleId: { cafeId: post.cafeId, articleId: post.articleId },
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
   * DELETE_POST: 게시글 삭제 (2단계)
   */
  private async handleDeletePost(
    jobId: string,
    _payload: Record<string, unknown>,
    _runMode: RunMode
  ): Promise<void> {
    await this.addLog(jobId, 'WARN', '게시글 삭제 기능은 아직 구현되지 않았습니다');
  }

  /**
   * 세션 에러 업데이트
   */
  private async updateSessionError(
    sessionId: string,
    errorMessage: string,
    errorCode?: ErrorCode
  ) {
    await this.prisma.naverSession.update({
      where: { id: sessionId },
      data: {
        status: 'ERROR',
        errorMessage,
        errorCode,
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
      errorCode?: ErrorCode;
    }
  ) {
    await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        startedAt: options?.startedAt,
        finishedAt: options?.finishedAt,
        errorMessage: options?.errorMessage,
        errorCode: options?.errorCode,
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
        completedJobs: jobStatus === 'completed' ? run.completedJobs + 1 : run.completedJobs,
        failedJobs: jobStatus === 'failed' ? run.failedJobs + 1 : run.failedJobs,
      };

      if (!run.startedAt) {
        updates.startedAt = new Date();
      }

      if (updates.completedJobs + updates.failedJobs >= run.totalJobs) {
        updates.status = updates.failedJobs === 0 ? 'COMPLETED' : 'FAILED';
        updates.finishedAt = new Date();
      }

      await this.prisma.scheduleRun.update({
        where: { id: scheduleRunId },
        data: updates,
      });

      logger.debug(
        `ScheduleRun ${scheduleRunId} updated: ${updates.completedJobs}/${run.totalJobs} completed, ${updates.failedJobs} failed`
      );
    } catch (error) {
      logger.error(`Failed to update ScheduleRun progress: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
