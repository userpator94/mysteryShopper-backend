import sharp from 'sharp';

const MAX_EDGE = 1920;
const JPEG_QUALITY = 82;

/**
 * Сжимает изображение для хранения в БД: поворот по EXIF, ограничение длинной стороны, JPEG.
 */
export async function compressReportImage(
  buffer: Buffer,
  _originalMime: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  let pipeline = sharp(buffer).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w > MAX_EDGE || h > MAX_EDGE) {
    pipeline = sharp(buffer).rotate().resize({
      width: w >= h ? MAX_EDGE : undefined,
      height: h > w ? MAX_EDGE : undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  const out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  return { buffer: out, mimeType: 'image/jpeg' };
}
