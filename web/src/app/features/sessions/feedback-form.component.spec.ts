import { TestBed } from '@angular/core/testing';
import { FeedbackInput } from '../../core/api.models';
import { FeedbackFormComponent } from './feedback-form.component';

describe('FeedbackFormComponent', () => {
  function create(initial: FeedbackInput | null = null) {
    TestBed.configureTestingModule({ imports: [FeedbackFormComponent] });
    const fixture = TestBed.createComponent(FeedbackFormComponent);
    fixture.componentRef.setInput('initial', initial);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('starts invalid until a recommendation and texts are provided', () => {
    const c = create();
    expect(c.form.valid).toBe(false);
    expect(c.form.controls.recommendation.hasError('required')).toBe(true);
  });

  it('rejects strengths shorter than 3 characters', () => {
    const c = create();
    c.form.patchValue({ recommendation: 'HIRE', strengths: 'ok', improvements: 'Discuss trade-offs' });
    expect(c.form.controls.strengths.hasError('minlength')).toBe(true);
    expect(c.form.valid).toBe(false);
  });

  it('emits integer scores and trimmed text on submit', () => {
    const c = create();
    const emitted: FeedbackInput[] = [];
    c.saved.subscribe((v) => emitted.push(v));
    c.form.patchValue({
      overallRating: 4,
      problemSolving: 3,
      communication: 5,
      technicalDepth: 4,
      codeQuality: 2,
      recommendation: 'HIRE',
      strengths: '  Clear reasoning ',
      improvements: ' More tests ',
      summary: '',
    });
    c.submit();
    expect(emitted).toEqual([
      {
        overallRating: 4,
        problemSolving: 3,
        communication: 5,
        technicalDepth: 4,
        codeQuality: 2,
        recommendation: 'HIRE',
        strengths: 'Clear reasoning',
        improvements: 'More tests',
        summary: null,
      },
    ]);
  });

  it('prefills existing feedback', () => {
    const c = create({
      overallRating: 2,
      problemSolving: 2,
      communication: 3,
      technicalDepth: 2,
      codeQuality: 1,
      recommendation: 'NO_HIRE',
      strengths: 'Calm',
      improvements: 'Practice graphs',
      summary: 'Keep going',
    });
    expect(c.form.getRawValue()).toMatchObject({ overallRating: 2, recommendation: 'NO_HIRE', summary: 'Keep going' });
  });
});
