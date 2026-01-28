import { Component, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { MobileBottomNav } from './shared/mobile-bottom-nav/mobile-bottom-nav';
import { Theme } from './core/theme';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,Navbar,MobileBottomNav],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit{
  constructor(private theme: Theme) {}
  ngOnInit(): void {
    this.theme.initTheme();
  }
  protected title = 'angular-ecommerce';
}
