/**
 * 암호화/복호화 유틸리티
 * Worker에서 NaverAccount 비밀번호 복호화에 사용
 *
 * AES-256-GCM 방식 사용 (packages/core와 동일한 로직)
 */

import * as crypto from 'crypto';

/** 암호화 알고리즘 */
const ALGORITHM = 'aes-256-gcm';
/** IV 길이 (12바이트 권장 for GCM) */
const IV_LENGTH = 12;
/** Auth Tag 길이 */
const AUTH_TAG_LENGTH = 16;

/**
 * 환경변수에서 암호화 키 가져오기
 * @throws 키가 없거나 잘못된 형식이면 에러
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. ' +
        '32바이트(64자 hex) 키를 설정해주세요.'
    );
  }

  // Hex 문자열을 Buffer로 변환 (32바이트 = 64 hex chars)
  const key = Buffer.from(keyHex, 'hex');

  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY는 32바이트(64자 hex)여야 합니다. 현재: ${key.length}바이트`
    );
  }

  return key;
}

/**
 * 암호화된 Base64 문자열을 복호화
 *
 * @param encryptedText 암호화된 데이터 (Base64)
 * @returns 복호화된 평문
 * @throws 복호화 실패 시 에러
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  // Base64 디코딩
  const combined = Buffer.from(encryptedText, 'base64');

  // IV, Auth Tag, 암호문 분리
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // 복호화 객체 생성
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // 복호화 수행
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}










