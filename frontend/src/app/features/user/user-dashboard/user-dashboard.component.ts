import { AfterViewInit, Component, OnInit } from '@angular/core';
import { CreditsService } from '../../../core/services/credits.service';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import * as AOS from 'aos';

@Component({
    selector: 'app-user-dashboard',
    templateUrl: './user-dashboard.component.html',
    styleUrls: ['./user-dashboard.component.css'],
    standalone: false
})
export class UserDashboardComponent implements OnInit, AfterViewInit {
    events: any[] = [];
    filteredEvents: any[] = [];
    searchTerm = '';
    credits: number = 0;
    addAmount: number = 0;
    showLogoutPopUp = false;
    showAddPopUp = false;
    userInitial: string = 'U';
    private viewInitialized = false;

    constructor(private userService: UserService, private router: Router, private authService: AuthService, private creditsService: CreditsService) { }

    ngOnInit() {
        this.loadEvents();
        this.loadCredits();
        
        const currentUser = this.authService.currentUserValue;
        if (currentUser) {
            if (currentUser.name) {
                this.userInitial = currentUser.name.charAt(0).toUpperCase();
            } else if (currentUser.email) {
                this.userInitial = currentUser.email.charAt(0).toUpperCase();
            }
        }
    }

    ngAfterViewInit() {
        this.viewInitialized = true;
        this.refreshAos();
    }

    loadEvents() {
        this.userService.getEvents().subscribe(data => {
            this.events = data;
            this.applyEventFilter();
            this.refreshAos();
        });
    }

    onSearchChange() {
        this.applyEventFilter();
    }

    private applyEventFilter() {
        const normalizedSearchTerm = this.searchTerm.trim().toLowerCase();
        this.filteredEvents = this.events.filter(event =>
            (event?.name ?? '').toLowerCase().includes(normalizedSearchTerm)
        );
        this.refreshAos();
    }

    private refreshAos() {
        if (!this.viewInitialized) return;
        setTimeout(() => AOS.refreshHard(), 0);
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

    goToMyBookings() {
        this.router.navigate(['/events/my-bookings']);
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
