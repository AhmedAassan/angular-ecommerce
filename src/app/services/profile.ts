// core/services/profile.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth'; // adjust the relative path if needed

interface ApiResponse<T> {
  status: boolean;
  data: T;
  msgEN?: string;
  msgAR?: string;
}

export interface ExternalProfile {
  externalId?: string;
  fullName?: string;
  email?: string;
  mobileNo?: string;
  customerRef?: string;
  branchId?: number;
  branchArabicName?: string;
  branchEnglishName?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  points?: number;
  // add any fields you see in the actual response screen
}
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangePasswordResponse {
  status: boolean;
  data: any;
  msgEN?: string;
  msgAR?: string;
}
export interface ResetPasswordDto {
  newPassword: string;
  confirmNewPassword: string;
}
export interface ResetPasswordResponse {
  status: boolean;
  data: any;
  msgEN?: string;
  msgAR?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiBase;

  getExternalProfile(): Observable<ExternalProfile> {
    // By default, ONLY Authorization: Bearer <token> is needed (interceptor adds it).
    // If your API ALSO requires refreshToken as query param, uncomment below:
    //
    // const rt = this.auth.getRefreshToken();
    // const params = rt ? new HttpParams().set('refreshToken', rt) : undefined;

    return this.http
      .get<ApiResponse<ExternalProfile>>(`${this.base}/api/GetExternalProfile`/*, { params }*/)
      .pipe(map(r => r?.data ?? ({} as ExternalProfile)));
  }

  changePassword(body: ChangePasswordDto): Observable<ChangePasswordResponse> {
    return this.http.post<ChangePasswordResponse>(
      `${this.base}/api/changePasswordExternal`,
      body
    );
  }
  resetPasswordExternal(body: ResetPasswordDto): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(
      `${this.base}/api/resetPasswordExternal`,
      body
    );
  }
}
