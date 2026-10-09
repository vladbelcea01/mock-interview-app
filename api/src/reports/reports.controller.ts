import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';

export class TrendsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  participantId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.reports.summary(user);
  }

  @Get('trends')
  trends(@Query() q: TrendsQueryDto, @CurrentUser() user: AuthUser) {
    return this.reports.trends(q.participantId, user, q.from, q.to);
  }
}
