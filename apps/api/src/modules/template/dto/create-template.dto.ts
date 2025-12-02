/**
 * 템플릿 생성 DTO
 */

import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

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
}




