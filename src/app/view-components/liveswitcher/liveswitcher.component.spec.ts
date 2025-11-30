import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveswitcherComponent } from './liveswitcher.component';

describe('LiveswitcherComponent', () => {
  let component: LiveswitcherComponent;
  let fixture: ComponentFixture<LiveswitcherComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ LiveswitcherComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(LiveswitcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
