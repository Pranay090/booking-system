import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AdminService {
    private apiUrl = 'http://localhost:3000'; // Should be env var

    constructor(private http: HttpClient) { }

    getTableData(tableName: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/admin/tables/${tableName}`);
    }

    createEvent(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/api/events`, data);
    }

    createShow(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/api/shows`, data);
    }

    // Bulk create seats with price
    createSeats(showId: number, seats: any[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/admin/shows/${showId}/seats`, { seats });
    }

    getEvents(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/api/events`);
    }
}
