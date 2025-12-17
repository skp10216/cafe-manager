/**
 * JWT Strategy
 * Passport JWT 인증 전략
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '@/common/prisma/prisma.service';
import { RequestUser } from '@/common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  /**
   * JWT 검증 후 사용자 정보 반환
   * 반환된 객체는 request.user에 저장됨
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    // 사용자 존재 확인
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다');
    }

    return {
      userId: user.id,
      sub: payload.sub,
      email: payload.email,
    };
  }
}









