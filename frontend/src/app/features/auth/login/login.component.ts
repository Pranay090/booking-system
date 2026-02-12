import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    standalone: false
})
export class LoginComponent implements OnInit {
    loginForm: FormGroup;
    hidePassword = true;

    constructor(
        private fb: FormBuilder,
        private authService: AuthService,
        private router: Router,
        private snackBar: MatSnackBar
    ) {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', Validators.required]
        });
    }
    
    ngOnInit() {
        this.autoLogin();
    }

    autoLogin() {
        const user:any = this.authService.autoLogin();
        if (user) {
            if (user.role === 'admin') {
                this.router.navigate(['/admin']);
            }
            else {
                this.router.navigate(['/events']);
            }
        }
    }

    onSubmit() {
        if (this.loginForm.valid) {
            this.authService.login(this.loginForm.value).subscribe({
                next: (res) => {
                    this.snackBar.open('Login successful!', 'Close', { duration: 3000 });
                    if (res.user.role === 'admin') {
                        this.router.navigate(['/admin']);
                    } else {
                        this.router.navigate(['/events']);
                    }
                },
                error: (err) => {
                    if (err.status === 401) {
                        this.snackBar.open('Invalid credentials', 'Close', { duration: 3000 });
                    } else {
                        this.snackBar.open('An error occurred. Please try again.', 'Close', { duration: 3000 });
                    }
                }
            });
        }
    }

    loginWithGoogle() {
        this.authService.loginWithGoogle();
    }
}
