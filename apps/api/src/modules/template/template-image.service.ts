/**
 * Template Image 서비스
 * 템플릿 이미지 관리 비즈니스 로직
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UploadService, UploadedFileInfo } from '../upload/upload.service';
import { MAX_IMAGES_PER_TEMPLATE } from '../upload/upload.module';

@Injectable()
export class TemplateImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 템플릿의 이미지 목록 조회
   */
  async findAll(templateId: string, userId: string) {
    // 템플릿 소유권 확인
    await this.verifyTemplateOwnership(templateId, userId);

    return this.prisma.templateImage.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * 이미지 추가
   * @param templateId 템플릿 ID
   * @param userId 사용자 ID
   * @param files 업로드된 파일들
   */
  async addImages(
    templateId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    // 템플릿 소유권 확인
    const template = await this.verifyTemplateOwnership(templateId, userId);

    // 현재 이미지 개수 확인
    const currentCount = await this.prisma.templateImage.count({
      where: { templateId },
    });

    // 최대 개수 검증
    if (currentCount + files.length > MAX_IMAGES_PER_TEMPLATE) {
      throw new BadRequestException(
        `최대 ${MAX_IMAGES_PER_TEMPLATE}개의 이미지만 등록할 수 있습니다. ` +
          `현재: ${currentCount}개, 추가 시도: ${files.length}개`,
      );
    }

    // 파일 정보 변환 및 저장
    const images = [];
    let nextOrder = currentCount;

    for (const file of files) {
      // 파일을 템플릿 디렉토리로 이동
      const { newPath, url } = await this.uploadService.moveFileToTemplate(
        file.path,
        userId,
        templateId,
      );

      // DB에 이미지 정보 저장
      const image = await this.prisma.templateImage.create({
        data: {
          templateId,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: newPath,
          url,
          order: nextOrder++,
        },
      });

      images.push(image);
    }

    return {
      message: `${images.length}개의 이미지가 추가되었습니다`,
      images,
      totalCount: currentCount + images.length,
    };
  }

  /**
   * 이미지 삭제
   */
  async deleteImage(templateId: string, imageId: string, userId: string) {
    // 템플릿 소유권 확인
    await this.verifyTemplateOwnership(templateId, userId);

    // 이미지 조회
    const image = await this.prisma.templateImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('이미지를 찾을 수 없습니다');
    }

    if (image.templateId !== templateId) {
      throw new ForbiddenException('해당 템플릿의 이미지가 아닙니다');
    }

    // 파일 시스템에서 삭제
    this.uploadService.deleteFile(image.path);

    // DB에서 삭제
    await this.prisma.templateImage.delete({
      where: { id: imageId },
    });

    // 순서 재정렬 (삭제된 이미지 이후 순서 조정)
    await this.prisma.templateImage.updateMany({
      where: {
        templateId,
        order: { gt: image.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    return {
      message: '이미지가 삭제되었습니다',
      deletedId: imageId,
    };
  }

  /**
   * 이미지 순서 변경
   */
  async reorderImages(templateId: string, userId: string, imageIds: string[]) {
    // 템플릿 소유권 확인
    await this.verifyTemplateOwnership(templateId, userId);

    // 현재 이미지 목록 조회
    const currentImages = await this.prisma.templateImage.findMany({
      where: { templateId },
      select: { id: true },
    });

    const currentIds = currentImages.map((img) => img.id);

    // 모든 이미지 ID가 유효한지 확인
    const invalidIds = imageIds.filter((id) => !currentIds.includes(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `유효하지 않은 이미지 ID: ${invalidIds.join(', ')}`,
      );
    }

    // 모든 이미지가 포함되어 있는지 확인
    const missingIds = currentIds.filter((id) => !imageIds.includes(id));
    if (missingIds.length > 0) {
      throw new BadRequestException(
        `누락된 이미지 ID: ${missingIds.join(', ')}. 모든 이미지 ID를 포함해야 합니다.`,
      );
    }

    // 순서 업데이트 (트랜잭션)
    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.templateImage.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    // 업데이트된 이미지 목록 반환
    return this.prisma.templateImage.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * 템플릿의 모든 이미지 삭제
   */
  async deleteAllImages(templateId: string, userId: string) {
    // 템플릿 소유권 확인
    await this.verifyTemplateOwnership(templateId, userId);

    // 이미지 목록 조회
    const images = await this.prisma.templateImage.findMany({
      where: { templateId },
    });

    // 파일 시스템에서 삭제
    for (const image of images) {
      this.uploadService.deleteFile(image.path);
    }

    // DB에서 삭제
    const result = await this.prisma.templateImage.deleteMany({
      where: { templateId },
    });

    return {
      message: `${result.count}개의 이미지가 삭제되었습니다`,
      deletedCount: result.count,
    };
  }

  /**
   * 템플릿 소유권 확인
   */
  private async verifyTemplateOwnership(templateId: string, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('템플릿을 찾을 수 없습니다');
    }

    if (template.userId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다');
    }

    return template;
  }

  /**
   * 이미지 경로 목록 반환 (Worker에서 사용)
   */
  async getImagePaths(templateId: string): Promise<string[]> {
    const images = await this.prisma.templateImage.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
      select: { path: true },
    });

    return images.map((img) => img.path);
  }

  /**
   * 이미지 URL 목록 반환
   */
  async getImageUrls(templateId: string): Promise<string[]> {
    const images = await this.prisma.templateImage.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
      select: { url: true },
    });

    return images.map((img) => img.url);
  }
}
