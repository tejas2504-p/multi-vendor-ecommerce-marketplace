import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Operation successful',
    statusCode: number = StatusCodes.OK,
    meta?: PaginationMeta
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    });
  }

  static created<T>(res: Response, data: T, message: string = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, StatusCodes.CREATED);
  }

  static noContent(res: Response) {
    return res.status(StatusCodes.NO_CONTENT).send();
  }
}

