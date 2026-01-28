// src/app/pages/dynamic-home/dynamic-home.ts
import { Component, Type, inject, OnInit } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';

import { AppModeService } from '../../services/app-mode';
import { BookingCategory } from '../booking-category/booking-category';
import { Home } from '../home/home';

@Component({
  selector: 'app-dynamic-home',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, BookingCategory, Home],
  template: `
    <ng-container *ngComponentOutlet="activeComponent"></ng-container>

    <!-- Dummy usage to silence TS-998113 (unused standalone imports) -->
    <ng-container *ngIf="false">
      <app-home></app-home>
      <app-booking-category></app-booking-category>
    </ng-container>
  `,
  styles: [`:host { display: contents; }`]
})
export class DynamicHome implements OnInit {
  readonly appMode = inject(AppModeService);

  // NgComponentOutlet expects a component Type or null
  activeComponent: Type<unknown> | null = null; // better than any [web:1]

  ngOnInit(): void {
    this.activeComponent = this.appMode.isBookingMode()
      ? BookingCategory
      : Home;
  }
}
