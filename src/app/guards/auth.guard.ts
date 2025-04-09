import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard {
    constructor(private authService: AuthService, private router: Router) { }

    canActivate(
        route: ActivatedRouteSnapshot,
        state: RouterStateSnapshot
    ): Observable<boolean> | boolean {
        // First check if user is already authenticated via synchronous API
        if (this.authService.isAuthenticated()) {
            console.log('AuthGuard: User is authenticated (sync check)');
            return true;
        }

        // If synchronous check fails, check via Observable
        console.log('AuthGuard: Checking authentication asynchronously');
        return this.authService.user$.pipe(
            take(1),
            map(user => {
                if (user) {
                    console.log('AuthGuard: User is authenticated (async check)');
                    return true;
                } else {
                    console.log('AuthGuard: User is NOT authenticated, redirecting to login');
                    this.router.navigate(['/login'], {
                        queryParams: { returnUrl: state.url }
                    });
                    return false;
                }
            })
        );
    }
}
