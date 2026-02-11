import { Component } from '@angular/core';
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
export class LoginComponent {
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
                    // Error handled by interceptor, but we can do local handling if needed
                }
            });
        }
    }

    loginWithGoogle() {
        this.authService.loginWithGoogle();
    }
}
