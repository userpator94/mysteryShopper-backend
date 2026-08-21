export {};

declare global {
  namespace Express {
    interface UploadedFile {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }

    interface Request {
      files?: Express.UploadedFile[];
    }
  }
}
