import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'app-auth-callback',
    template: `
        <div class="callback-container">
            <mat-spinner></mat-spinner>
            <p>Processing authentication...</p>
        </div>
    `,
    styles: [`
        .callback-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 20px;
        }
        p {
            font-size: 16px;
            color: #666;
        }
    `],
    standalone: true,
    imports: [MatProgressSpinnerModule]
})
export class AuthCallbackComponent implements OnInit {
    constructor(
        private route: ActivatedRoute,
        private authService: AuthService,
        private snackBar: MatSnackBar
    ) {}

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            const token = params['token'];
            const role = params['role'];
            const error = params['error'];

            if (error) {
                this.snackBar.open('Authentication failed. Please try again.', 'Close', { duration: 3000 });
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } else if (token) {
                this.authService.handleOAuthCallback(token, role);
            }
        });
    }
}
