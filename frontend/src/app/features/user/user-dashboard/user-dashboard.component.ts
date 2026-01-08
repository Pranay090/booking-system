import { Component } from '@angular/core';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-user-dashboard',
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.css'],
    standalone: false
})
export class UserDashboardComponent {
    events: any[] = [];

    constructor(private userService: UserService, private router: Router, private authService: AuthService) {
        this.userService.getEvents().subscribe(data => this.events = data);
    }

    onBook(eventId: number) {
        this.router.navigate(['/events/book', eventId]);
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
