import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AllocatorTableComponent } from './allocator-table.component';

describe('AllocatorTableComponent', () => {
  let component: AllocatorTableComponent;
  let fixture: ComponentFixture<AllocatorTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AllocatorTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AllocatorTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
