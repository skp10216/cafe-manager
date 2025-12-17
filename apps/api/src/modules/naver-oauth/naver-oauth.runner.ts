/**
 * NaverOAuth Runner
 * - OAuth state cleanup
 * - 만료 임박 토큰 자동 refresh
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NaverOAuthService } from './naver-oauth.service';

@Injectable()
export class NaverOAuthRunner {
  private readonly logger = new Logger(NaverOAuthRunner.name);

  constructor(private readonly naverOAuthService: NaverOAuthService) {}

  /**
   * 1분마다:
   * - 만료된 state 정리
   * - 만료 임박(5분 이내) 토큰 자동 갱신(최대 20개)
   */
  @Cron('*/1 * * * *')
  async tick() {
    try {
      const stateRes = await this.naverOAuthService.cleanupStates();
      if (stateRes.deleted > 0) {
        this.logger.log(`OAuth state 정리: ${stateRes.deleted}건 삭제`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`OAuth state 정리 실패: ${msg}`);
    }

    try {
      const refreshRes = await this.naverOAuthService.refreshExpiringTokens({
        withinMinutes: 5,
        limit: 20,
      });
      if (refreshRes.refreshed > 0) {
        this.logger.log(`OAuth 토큰 자동 갱신: ${refreshRes.refreshed}건`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`OAuth 토큰 자동 갱신 실패: ${msg}`);
    }
  }
}




