/**
 * @Public() 데코레이터
 * 인증 없이 접근 가능한 엔드포인트를 표시
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 인증 없이 접근 가능하도록 설정하는 데코레이터
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);




