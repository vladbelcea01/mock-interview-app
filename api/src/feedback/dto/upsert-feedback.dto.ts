import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Trim } from '../../common/transforms';
import { recommendationEnum } from '../../db/schema';
import type { Recommendation } from '../../db/schema';

const Score = () => (target: object, key: string) => {
  IsInt()(target, key);
  Min(1)(target, key);
  Max(5)(target, key);
  ApiProperty({ minimum: 1, maximum: 5, example: 4 })(target, key);
};

const Text = (example: string) => (target: object, key: string) => {
  Trim()(target, key);
  IsString()(target, key);
  MinLength(3)(target, key);
  MaxLength(4000)(target, key);
  ApiProperty({ example })(target, key);
};

export class UpsertFeedbackDto {
  @Score() overallRating!: number;
  @Score() problemSolving!: number;
  @Score() communication!: number;
  @Score() technicalDepth!: number;
  @Score() codeQuality!: number;

  @ApiProperty({ enum: recommendationEnum.enumValues })
  @IsIn(recommendationEnum.enumValues)
  recommendation!: Recommendation;

  @Text('Clear decomposition of the problem') strengths!: string;
  @Text('Discuss trade-offs earlier') improvements!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  summary?: string;
}
