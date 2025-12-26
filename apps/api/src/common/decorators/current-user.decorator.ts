/**
 * @CurrentUser() 데코레이터
 * 현재 인증된 사용자 정보를 주입
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

/** JWT 페이로드에서 추출된 사용자 정보 */
export interface JwtPayload {
  sub: string; // userId
  email: string;
}

/** 요청에 포함된 사용자 정보 */
export interface RequestUser extends JwtPayload {
  userId: string;
}

/**
 * 현재 인증된 사용자 정보를 가져오는 데코레이터
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: RequestUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (data) {
      return user[data];
    }

    return user;
  }
);











