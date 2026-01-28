import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';


export interface Area {
  id: number;
  arabicName: string;
  englishName: string;
}

export interface CustomerAddress {
  id: number;            // 0 on create
  areaId: number;
  avenue: string;
  street: string;
  blockNumber: string;
  buildingNumber: string;
  floorNumber: string;
  flatNumber: string;
  addressLink: string;
  note: string;
  deliveryCharge: number;
}

export interface ApiEnvelope<T> {
  status: boolean;
  data: T;
  msgEN?: string | null;
  msgAR?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly base = environment.apiBase;

  constructor(private http: HttpClient) { }

  /** GET /api/GetCustomerAddressesByRef — uses auth token, no params */
  getMyAddresses(): Observable<CustomerAddress[]> {
    return this.http
      .get<ApiEnvelope<CustomerAddress[]>>(`${this.base}/api/GetCustomerAddressesByRef`)
      .pipe(map(r => r.data ?? []));
  }

  /** GET /api/GetAreas */
  getAreas(): Observable<Area[]> {
    return this.http.get<ApiEnvelope<Area[]>>(`${this.base}/api/GetAreas`)
      .pipe(map(r => r.data ?? []));
  }

  /** POST /api/addCustomerAddresses — id MUST be 0 */
  addAddress(body: CustomerAddress) {
    return this.http.post<ApiEnvelope<any>>(`${this.base}/api/addCustomerAddresses`, { ...body, id: 0 });
  }

  /** PUT /api/editCustomerAddresses — id MUST be the real id */
  editAddress(body: CustomerAddress) {
    return this.http.post<ApiEnvelope<any>>(`${this.base}/api/editCustomerAddresses`, body);
  }

  /** POST /api/deleteCustomerAdress?Id= */
  deleteAddress(id: number) {
    const params = new HttpParams().set('Id', id);
    return this.http.post<ApiEnvelope<null>>(`${this.base}/api/deleteCustomerAdress`, null, { params });
  }
}
