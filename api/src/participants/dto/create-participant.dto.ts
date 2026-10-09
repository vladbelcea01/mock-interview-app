import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/transforms';
import { seniorityEnum } from '../../db/schema';
import type { Seniority } from '../../db/schema';

export class CreateParticipantDto {
  @ApiProperty({ example: 'Ana Popescu' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'ana@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Backend Engineer' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  targetRole!: string;

  @ApiProperty({ enum: seniorityEnum.enumValues })
  @IsIn(seniorityEnum.enumValues)
  seniority!: Seniority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
