import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RunContainerDto {
    @IsString()
    @IsNotEmpty()
    public branch: string;

    @IsOptional()
    @IsString()
    public checkout: string;

    @IsOptional()
    @IsString()
    public authToken: string;

    @IsOptional()
    @IsString()
    public authUser: string;
}

export class ContainerLogsDto {
    @IsString()
    @IsNotEmpty()
    public name: string;
}
