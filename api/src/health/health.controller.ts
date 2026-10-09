import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { DbService } from '../db/db.service';

const DB_TIMEOUT_MS = 3000;

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dbService: DbService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    try {
      await Promise.race([
        this.dbService.pool.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS).unref()),
      ]);
      return { status: 'ok', db: 'up' };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', db: 'down' };
    }
  }
}
