/**
 * Naver OAuth 연결 계정 응답 DTO
 */
export class NaverOAuthAccountResponse {
  id: string;
  naverUserId: string;
  email: string | null;
  nickname: string | null;
  name: string | null;
  profileImageUrl: string | null;
  tokenExpiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
}




