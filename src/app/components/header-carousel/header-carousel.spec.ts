import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderCarousel } from './header-carousel';

describe('HeaderCarousel', () => {
  let component: HeaderCarousel;
  let fixture: ComponentFixture<HeaderCarousel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderCarousel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderCarousel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
