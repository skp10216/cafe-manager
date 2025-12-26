/**
 * 템플릿 생성 DTO
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 거래 방법 enum
 */
export enum TradeMethod {
  DIRECT = 'DIRECT',     // 직거래
  DELIVERY = 'DELIVERY', // 택배
  BOTH = 'BOTH',         // 둘 다 가능
}

/**
 * 템플릿 변수 정의
 */
export class TemplateVariableDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsOptional()
  defaultValue?: string;

  @IsOptional()
  required?: boolean;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty({ message: '템플릿 이름을 입력하세요' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: '카페 ID를 입력하세요' })
  cafeId: string;

  @IsString()
  @IsNotEmpty({ message: '게시판 ID를 입력하세요' })
  boardId: string;

  @IsOptional()
  @IsString()
  cafeName?: string;

  @IsOptional()
  @IsString()
  boardName?: string;

  @IsString()
  @IsNotEmpty({ message: '제목 템플릿을 입력하세요' })
  @MaxLength(200)
  subjectTemplate: string;

  @IsString()
  @IsNotEmpty({ message: '본문 템플릿을 입력하세요' })
  contentTemplate: string;

  /**
   * 템플릿 변수 정의 (JSON 배열)
   * 예: [{"key": "상품명", "label": "상품명", "defaultValue": "", "required": true}]
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateVariableDto)
  variables?: TemplateVariableDto[];

  /**
   * 상품 가격 (상품 게시판용)
   */
  @IsOptional()
  @IsInt()
  @Min(0, { message: '가격은 0 이상이어야 합니다' })
  price?: number;

  /**
   * 거래 방법 (상품 게시판용)
   */
  @IsOptional()
  @IsEnum(TradeMethod, { message: '유효한 거래 방법을 선택하세요' })
  tradeMethod?: TradeMethod;

  /**
   * 거래 지역 (상품 게시판용)
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tradeLocation?: string;
}











