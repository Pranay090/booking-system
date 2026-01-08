import { Component } from '@angular/core';
import { LoaderService } from '../../../core/services/loader.service';

@Component({
    selector: 'app-loader',
    templateUrl: './loader.component.html',
    styleUrls: ['./loader.component.css'],
    standalone: false
})
export class LoaderComponent {
    constructor(public loaderService: LoaderService) { }
}
