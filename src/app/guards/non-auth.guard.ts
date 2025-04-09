import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class NonAuthGuard implements CanActivate {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(): Observable<boolean> {
        return this.authService.user$.pipe(
            take(1),
            map(user => {
                if (user) {
                    // User is already logged in, redirect to home
                    console.log('NonAuthGuard: User is already authenticated, redirecting to home');
                    this.router.navigate(['/home']);
                    return false;
                }
                // User is not logged in, allow access to login page
                console.log('NonAuthGuard: User is not authenticated, allowing access to login');
                return true;
            })
        );
    }
} 