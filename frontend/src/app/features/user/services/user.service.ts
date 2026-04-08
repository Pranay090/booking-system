import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getEvents(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/api/events`);
    }

    getShows(eventId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/api/events/${eventId}/shows`);
    }

    getSeats(showId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/shows/${showId}/seats`); // Note: seats.js route
    }

    bookSeats(bookingData: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/book`, bookingData); // Note: booking.js route
    }

    getMyBookings(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/user/bookings`);
    }
}
