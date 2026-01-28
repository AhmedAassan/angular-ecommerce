import { Component, Input } from '@angular/core';

export interface CarouselSlide {
  id: number;
  imageSrc: string;
  altText: string;
}

@Component({
  selector: 'app-header-carousel',
  standalone: true,
  imports: [],
  templateUrl: './header-carousel.html',
  styleUrls: ['./header-carousel.scss']
})
export class HeaderCarousel {
  
  @Input() slides: CarouselSlide[] = [
    {
      id: 1,
      imageSrc: 'assets/images/Abaya.png',
      altText: 'Elegant Abaya Collection'
    },
    {
      id: 2,
      imageSrc: 'assets/images/formal.png',
      altText: 'Formal Wear Collection'
    }
  ];

  currentSlide = 0;

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
  }

  prevSlide(): void {
    this.currentSlide = (this.currentSlide - 1 + this.slides.length) % this.slides.length;
  }

  goToSlide(index: number): void {
    this.currentSlide = index;
  }
}