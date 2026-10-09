import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Trim } from '../common/transforms';
import { SearchService } from './search.service';

export class SearchQueryDto {
  @ApiProperty({ minLength: 2, maxLength: 100, example: 'graph' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;
}

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() { q }: SearchQueryDto, @CurrentUser() user: AuthUser) {
    return this.searchService.search(q, user);
  }
}
