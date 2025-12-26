/**
 * Admin Guard
 * 관리자 권한 검증
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다');
    }

    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('관리자 권한이 필요합니다');
    }

    return true;
  }
}


