import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookingCategory } from './booking-category';

describe('BookingCategory', () => {
  let component: BookingCategory;
  let fixture: ComponentFixture<BookingCategory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingCategory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookingCategory);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
