import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'http';

interface PgLikeError {
  code?: string;
  cause?: { code?: string };
}

const PG_ERROR_MAP: Record<string, { status: number; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, message: 'A record with these details already exists' },
  '23503': { status: HttpStatus.BAD_REQUEST, message: 'A referenced record does not exist' },
  '22P02': { status: HttpStatus.BAD_REQUEST, message: 'Invalid input value' },
};

/** Every error leaves the API in one shape: { statusCode, error, message, path, timestamp }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
    } else {
      const pgCode = (exception as PgLikeError)?.cause?.code ?? (exception as PgLikeError)?.code;
      const mapped = pgCode ? PG_ERROR_MAP[pgCode] : undefined;
      if (mapped) {
        statusCode = mapped.status;
        message = mapped.message;
      } else {
        this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      }
    }

    res.status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
