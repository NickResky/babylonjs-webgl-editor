import { Routes } from '@angular/router';
import { HomeComponent } from './view-components/home/home.component';

export const routes: Routes = [
  {
    path: '**',
    component: HomeComponent,
  }
];

