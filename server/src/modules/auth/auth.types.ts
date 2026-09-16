export interface LoginDto {
  email: string;
  password: string;
}

export interface JwtPayload {
  userId: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
