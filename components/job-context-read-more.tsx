'use client';

import { useState } from 'react';

export function JobContextReadMore({ jobTitle }: { jobTitle: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="text-sm leading-relaxed text-carnival-ink/80">
      <h3 className="text-base font-black text-carnival-ink/80">Brief Organisational Context</h3>
      <p className="mt-2">
        Congratulations on reaching the exciting stage where you are considering formal employment with The Circus
        (hereafter referred to as &ldquo;the Organisation,&rdquo; &ldquo;the Big Top,&rdquo; and, in certain historical documents,
        &ldquo;that place where the incident happened&rdquo;).
      </p>
      <p className="mt-2">
        By submitting an application for the role of <strong>{jobTitle}</strong>, you are expressing interest in joining
        a dynamic, fast-paced, paperwork-intensive environment where risk is not a possibility but a recurring theme.
      </p>

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-sm font-bold text-carnival-red underline decoration-carnival-red/70 underline-offset-2 hover:text-red-700"
        >
          Read more
        </button>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-2">
          <p>
            While the Organisation maintains a robust commitment to policies, procedures, training modules, laminated signage,
            and a truly inspirational volume of disclaimers, it must be noted, purely in the spirit of transparency, that circus
            work may involve:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>unexpected heights</li>
            <li>unexpected animals</li>
            <li>expected animals behaving unexpectedly</li>
            <li>momentum</li>
            <li>physics</li>
            <li>applause-related overconfidence</li>
            <li>and occasional Events requiring the completion of Form 12-B (&ldquo;Statement of How This Happened&rdquo;)</li>
          </ul>
          <p>
            We cannot guarantee personal safety, emotional stability, or continued possession of all original limbs. We can,
            however, offer a deeply memorable workplace culture, intermittent snacks, and the rare privilege of being able to
            say: &ldquo;Yeah, that happened to me at work.&rdquo;
          </p>
          <p className="font-bold">Thank you for your attention to this matter.</p>
          <p className="pt-1">
            <span className="font-bold">Sue</span><br />
            <span className="font-semibold">Ministry of Human Affairs</span>
          </p>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-2 text-sm font-bold text-carnival-red underline decoration-carnival-red/70 underline-offset-2 hover:text-red-700"
          >
            Collapse
          </button>
        </div>
      ) : null}
    </section>
  );
}
