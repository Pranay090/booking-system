import { Component } from '@angular/core';
import { CreditsService } from '../../../core/services/credits.service';
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
    credits: number = 0;
    addAmount: number = 0;


    constructor(private userService: UserService, private router: Router, private authService: AuthService, private creditsService: CreditsService) {
        this.userService.getEvents().subscribe(data => this.events = data);
        this.loadCredits();
    }

    loadCredits() {
        this.creditsService.getCredits().subscribe(res => this.credits = res.credits);
    }

    onAddCredits() {
        if (this.addAmount > 0) {
            this.creditsService.addCredits(this.addAmount).subscribe(res => {
                this.credits = res.credits;
                this.addAmount = 0;
            });
        }
    }

    onBook(eventId: number) {
        this.router.navigate(['/events/book', eventId]);
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }
}
