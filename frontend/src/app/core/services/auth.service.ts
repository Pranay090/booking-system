import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = `${environment.apiUrl}/auth`;
    private currentUserSubject = new BehaviorSubject<any>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient, private router: Router) {
        this.loadUser();
    }

    private loadUser() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                console.log('Decoded token:', decoded);
                this.currentUserSubject.next(decoded);
            } catch (e) {
                this.logout();
            }
        }
    }

    autoLogin() {
        const token = localStorage.getItem('token');
        if(token){
            this.loadUser();
            const decoded = jwtDecode(token);
            return decoded;
        }
        return null;
    }

    login(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
            tap((res: any) => {
                localStorage.setItem('token', res.token);
                this.loadUser();
            })
        );
    }

    register(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/register`, data).pipe(
            tap((res: any) => {
                // auto login
                localStorage.setItem('token', res.token);
                this.loadUser();
            })
        );
    }

    // Initialize Google OAuth login
    loginWithGoogle() {
        window.location.href = `${this.apiUrl}/google`;
    }

    // Handle OAuth callback from backend
    handleOAuthCallback(token: string, role: string): void {
        if (token) {
            localStorage.setItem('token', token);
            this.loadUser();
            if (role === 'admin') {
                this.router.navigate(['/admin']);
            } else {
                this.router.navigate(['/events']);
            }
        } else {
            this.router.navigate(['/login'], { queryParams: { error: 'authentication_failed' } });
        }
    }

    logout() {
        localStorage.removeItem('token');
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
    }

    getToken() {
        return localStorage.getItem('token');
    }

    get currentUserValue() {
        return this.currentUserSubject.value;
    }
}
