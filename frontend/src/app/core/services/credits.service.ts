import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CreditsService {
    private apiUrl = 'http://localhost:3000/user';
    constructor(private http: HttpClient) { }

    getCredits(): Observable<any> {
        return this.http.get(`${this.apiUrl}/credits`);
    }

    addCredits(amount: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/credits/add`, { amount });
    }
}
