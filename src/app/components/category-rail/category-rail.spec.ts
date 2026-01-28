import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryRail } from './category-rail';

describe('CategoryRail', () => {
  let component: CategoryRail;
  let fixture: ComponentFixture<CategoryRail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryRail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryRail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
