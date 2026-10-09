import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { Trim } from '../../common/transforms';
import { sessionStatusEnum, sessionTypeEnum } from '../../db/schema';
import type { SessionStatus, SessionType } from '../../db/schema';

export const SESSION_SORT_FIELDS = ['scheduledAt', 'createdAt', 'title'] as const;
export type SessionSortField = (typeof SESSION_SORT_FIELDS)[number];

export class QuerySessionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: sessionStatusEnum.enumValues })
  @IsOptional()
  @IsIn(sessionStatusEnum.enumValues)
  status?: SessionStatus;

  @ApiPropertyOptional({ enum: sessionTypeEnum.enumValues })
  @IsOptional()
  @IsIn(sessionTypeEnum.enumValues)
  type?: SessionType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  participantId?: string;

  @ApiPropertyOptional({ description: 'Scheduled at or after (ISO date)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ description: 'Scheduled at or before (ISO date)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @ApiPropertyOptional({ description: 'Title contains (case-insensitive)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: SESSION_SORT_FIELDS, default: 'scheduledAt' })
  @IsOptional()
  @IsIn(SESSION_SORT_FIELDS)
  sort: SessionSortField = 'scheduledAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
