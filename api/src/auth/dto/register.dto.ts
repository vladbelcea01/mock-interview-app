import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/transforms';

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'secret123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt only uses the first 72 bytes
  password!: string;

  @ApiProperty({ example: 'Ana Popescu' })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
