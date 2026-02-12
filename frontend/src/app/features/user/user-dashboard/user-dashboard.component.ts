import { Component, OnInit } from '@angular/core';
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
export class UserDashboardComponent implements OnInit {
    events: any[] = [];
    credits: number = 0;
    addAmount: number = 0;
    showLogoutPopUp = false;
    showAddPopUp = false;

    constructor(private userService: UserService, private router: Router, private authService: AuthService, private creditsService: CreditsService) {
        this.userService.getEvents().subscribe(data => this.events = data);
    }

    ngOnInit() {
        this.loadCredits();
    }

    loadCredits() {
        this.creditsService.getCredits().subscribe(res => {
            Promise.resolve().then(() => {
                this.credits = Number(res.credits);
            });
        });
    }

    onAddCredits() {
        if (this.addAmount > 0) {
            this.creditsService.addCredits(this.addAmount).subscribe(res => {
                this.credits = res.credits;
                this.addAmount = 0;
            });
            this.showAddPopUp = false;
        }
    }

    onAdd() {
        this.showAddPopUp = true;
    }

    onCancelPopup() {
        this.showAddPopUp = false;
    }

    onBook(eventId: number) {
        this.router.navigate(['/events/book', eventId]);
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    onLogout() {
        this.showLogoutPopUp = true;
    }

    cancelPopup() {
        this.showLogoutPopUp = false;
    }    
}
