import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CreditsService {
    private apiUrl = `${environment.apiUrl}/user`;
    constructor(private http: HttpClient) { }

    getCredits(): Observable<any> {
        return this.http.get(`${this.apiUrl}/credits`);
    }

    addCredits(amount: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/credits/add`, { amount });
    }
}
