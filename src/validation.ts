import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RunContainerDto {
  @ApiProperty({ description: 'The branch this deployment corresponds to', example: 'main', required: true })
  @IsString()
  @IsNotEmpty()
  public branch: string;

  @ApiProperty({ description: 'Whether to checkout a tag or commit hash', example: '1.0.0', required: false })
  @IsOptional()
  @IsString()
  public checkout: string;

  @ApiProperty({ description: 'The username to authenticate with, if required', example: 'nico', required: false })
  @IsOptional()
  @IsString()
  public authToken: string;

  @ApiProperty({
    description: 'The API token to use while cloning the repository, if required',
    example: 'gh-token-xyz',
    required: false,
  })
  @IsOptional()
  @IsString()
  public authUser: string;
}

export class ContainerLogsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public name: string;
}

export class DeleteDeploymentDto {
  @ApiProperty({
    description: 'The name of the deployment to delete, usually used after deleting a branch.',
    example: 'main',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  public branch: string;
}
