import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../services/loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
    private totalRequests = 0;
    private loaderStartTime = 0;
    private readonly minimumLoaderTime = 0; // currently removed it but may next time we can see about progress bar min time after deploying second

    constructor(private loaderService: LoaderService) {}

    intercept(
        request: HttpRequest<unknown>,
        next: HttpHandler
    ): Observable<HttpEvent<unknown>> {

        this.totalRequests++;

        // If first request, record start time and show loader
        if (this.totalRequests === 1) {
            this.loaderStartTime = Date.now();
            this.loaderService.show();
        }

        return next.handle(request).pipe(
            finalize(() => {
                this.totalRequests--;

                if (this.totalRequests === 0) {
                    const elapsedTime = Date.now() - this.loaderStartTime;

                    if (elapsedTime >= this.minimumLoaderTime) {
                        this.loaderService.hide();
                    } else {
                        const remainingTime = this.minimumLoaderTime - elapsedTime;
                        setTimeout(() => {
                            this.loaderService.hide();
                        }, remainingTime);
                    }
                }
            })
        );
    }
}

