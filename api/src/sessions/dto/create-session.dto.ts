import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../../common/transforms';
import { sessionTypeEnum } from '../../db/schema';
import type { SessionType } from '../../db/schema';

export const MIN_DURATION = 15;
export const MAX_DURATION = 240;

export class CreateSessionDto {
  @ApiProperty({ example: 'System design: URL shortener' })
  @Trim()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ enum: sessionTypeEnum.enumValues })
  @IsIn(sessionTypeEnum.enumValues)
  type!: SessionType;

  @ApiProperty({
    example: '2026-10-20T10:00:00.000Z',
    description: 'May be in the past to log an interview already held',
  })
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;

  @ApiProperty({ minimum: MIN_DURATION, maximum: MAX_DURATION, example: 60 })
  @IsInt()
  @Min(MIN_DURATION)
  @Max(MAX_DURATION)
  durationMin!: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  participantId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
