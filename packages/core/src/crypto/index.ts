/**
 * 암호화/복호화 유틸리티
 * AES-256-GCM 방식으로 민감한 데이터 암호화/복호화
 *
 * 환경변수 ENCRYPTION_KEY 필수 (32바이트 = 64 hex characters)
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
 * 평문을 암호화하여 Base64 문자열로 반환
 *
 * @param plainText 암호화할 평문
 * @returns 암호화된 데이터 (Base64: iv + authTag + cipherText)
 *
 * @example
 * const encrypted = encrypt('myPassword123');
 * // => 'AbCdEfGhIjKl...' (Base64)
 */
export function encrypt(plainText: string): string {
  const key = getEncryptionKey();
  
  // 무작위 IV 생성
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // 암호화 객체 생성
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // 암호화 수행
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  
  // Auth Tag 가져오기
  const authTag = cipher.getAuthTag();
  
  // IV + Auth Tag + 암호문을 합쳐서 Base64로 인코딩
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString('base64');
}

/**
 * 암호화된 Base64 문자열을 복호화
 *
 * @param encryptedText 암호화된 데이터 (Base64)
 * @returns 복호화된 평문
 * @throws 복호화 실패 시 에러
 *
 * @example
 * const decrypted = decrypt('AbCdEfGhIjKl...');
 * // => 'myPassword123'
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

/**
 * 암호화 키 생성 헬퍼 (CLI 용도)
 * 환경변수 ENCRYPTION_KEY에 사용할 32바이트 랜덤 키 생성
 *
 * @returns 64자 hex 문자열 (32바이트)
 *
 * @example
 * console.log(generateEncryptionKey());
 * // => 'a1b2c3d4e5f6...' (64자)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}








