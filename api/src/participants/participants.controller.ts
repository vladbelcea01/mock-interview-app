import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { QueryParticipantsDto } from './dto/query-participants.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { ParticipantsService } from './participants.service';

@ApiTags('participants')
@ApiBearerAuth()
@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  findAll(@Query() query: QueryParticipantsDto) {
    return this.participants.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.participants.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateParticipantDto, @CurrentUser() user: AuthUser) {
    return this.participants.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateParticipantDto) {
    return this.participants.update(id, dto);
  }
}
