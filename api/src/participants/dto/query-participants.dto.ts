import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';
import { Trim } from '../../common/transforms';

export class QueryParticipantsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name or email (case-insensitive, partial)' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;
}
