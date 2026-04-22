export function renderLandingPage(container: HTMLElement): void {
  container.innerHTML = `
<nav id="mainNav">
  <a href="#" class="brand">
    <div class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 3C16 3 7 15.2 7 21C7 25.9706 11.0294 30 16 30C20.9706 30 25 25.9706 25 21C25 15.2 16 3 16 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="16" cy="22" r="3" fill="currentColor"/>
      </svg>
    </div>
    DripWell
  </a>
  <div class="nav-links">
    <a href="#spectrum">Spectrum</a>
    <a href="#how">How it works</a>
    <a href="#consistency">Consistency</a>
    <a href="#science">Science</a>
    <a href="#pricing">Pricing</a>
    <a href="#cta" class="nav-cta">Request access</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg">
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
  </div>

  <div class="hero-inner">
    <div>
      <div class="hero-pill">
        <span class="hero-pill-dot" aria-hidden="true"></span>
        AI Wellness Assessment · Built for IV Therapy
      </div>

      <h1 class="hero-title">
        Between a quick chat<br>
        and a blood draw, <em>there's a better way.</em>
      </h1>

      <p class="hero-sub">
        DripWell runs a clinically-grounded wellness assessment in your exam room in five minutes. Vision AI observes the signals a trained dietitian would — then your provider walks the patient through the results, <strong>right there during the consult.</strong>
      </p>

      <div class="cta-row">
        <a href="#cta" class="btn-primary">
          Request early access
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true"><path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <a href="#spectrum" class="btn-ghost">See how it compares</a>
      </div>

    </div>
  </div>
</section>

<!-- SPECTRUM -->
<section class="section section--tinted reveal" id="spectrum">
  <div class="section-inner">
    <div class="eyebrow">The assessment spectrum</div>
    <h2 class="section-title">
      Every IV clinic has two options.<br>
      <em>DripWell is the third.</em>
    </h2>
    <p class="section-lead">
      Until now, the only way to personalize a drip was either a quick verbal intake or a full lab panel. One is too shallow. The other is too slow. DripWell gives you something <strong>clinically meaningful that fits inside the consultation.</strong>
    </p>

    <div class="spectrum-grid">
      <div class="spec-card spec-card--left">
        <div class="spec-tier">Status quo</div>
        <div class="spec-name">The 30-second chat</div>
        <div class="spec-desc">What most IV clinics do today.</div>

        <div class="spec-metrics">
          <div class="metric">
            <span class="metric-label">Clinical depth</span>
            <span class="metric-val">Low</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.12;"></div></div>
          </div>
          <div class="metric">
            <span class="metric-label">Speed</span>
            <span class="metric-val">Instant</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.95;"></div></div>
          </div>
          <div class="metric">
            <span class="metric-label">Objectivity</span>
            <span class="metric-val">Subjective</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.15;"></div></div>
          </div>
        </div>

        <ul class="spec-list">
          <li>"How are you feeling today?"</li>
          <li>Different answer from every provider</li>
          <li>Nothing to reference on return visits</li>
          <li>Upsells feel like a sales pitch</li>
        </ul>
      </div>

      <div class="spec-card spec-card--hero">
        <div class="spec-badge">DripWell</div>
        <div class="spec-tier">The sweet spot</div>
        <div class="spec-name">AI visual assessment</div>
        <div class="spec-desc">Clinical depth, in the consultation, in 5 minutes.</div>

        <div class="spec-metrics">
          <div class="metric">
            <span class="metric-label">Clinical depth</span>
            <span class="metric-val">Clinical</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.78;"></div></div>
          </div>
          <div class="metric">
            <span class="metric-label">Speed</span>
            <span class="metric-val">5 minutes</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.82;"></div></div>
          </div>
          <div class="metric">
            <span class="metric-label">Objectivity</span>
            <span class="metric-val">Structured</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.85;"></div></div>
          </div>
        </div>

        <ul class="spec-list">
          <li>Vision AI + adaptive questioning</li>
          <li>Grounded in NFPE clinical methodology</li>
          <li>Results reviewed with patient during visit</li>
          <li>Recommendations backed by observed evidence</li>
        </ul>
      </div>

      <div class="spec-card spec-card--right">
        <div class="spec-tier">Gold standard</div>
        <div class="spec-name">Diagnostic blood work</div>
        <div class="spec-desc">The most accurate — but impractical for every visit.</div>

        <div class="spec-metrics">
          <div class="metric">
            <span class="metric-label">Clinical depth</span>
            <span class="metric-val">Highest</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.98;"></div></div>
          </div>
          <div class="metric">
            <span class="metric-label">Speed</span>
            <span class="metric-val">Days</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 0.2;"></div></div>
          </div>
          <div class="metric">
            <span class="metric-label">Objectivity</span>
            <span class="metric-val">Quantified</span>
            <div class="metric-track"><div class="metric-fill" style="--w: 1;"></div></div>
          </div>
        </div>

        <ul class="spec-list">
          <li>Quantitative, lab-verified data</li>
          <li>Requires draw, lab, waiting period</li>
          <li>Expensive to run every visit</li>
          <li>Not practical for walk-in IV workflows</li>
        </ul>
      </div>
    </div>

    <div class="truth-callout">
      <div class="truth-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14.09 8.26L20.5 8.5L15.5 12.74L17.18 19L12 15.5L6.82 19L8.5 12.74L3.5 8.5L9.91 8.26L12 2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="truth-body">
        <h4>Blood work will always be the gold standard.</h4>
        <p>We're not pretending otherwise. <strong>But blood work takes a lab, a draw, and a multi-day wait</strong> — which means most IV clinics never run one. DripWell runs in the exam room during the consult. Your provider reviews the results with the patient, right there, while they're still seated. It's the difference between guessing and knowing.</p>
      </div>
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="section reveal" id="how">
  <div class="section-inner">
    <div class="eyebrow">How it works</div>
    <h2 class="section-title">
      Five minutes.<br>
      <em>One real assessment.</em>
    </h2>
    <p class="section-lead">
      Runs on a tablet in the exam room. The provider captures photos, the AI asks the right follow-up questions, and results are reviewed with the patient in real-time.
    </p>

    <div class="steps">
      <div class="step">
        <div class="step-num-wrap">01</div>
        <div class="step-head">
          <span class="step-tag">Capture · 90s</span>
          <h3>See what the body is showing.</h3>
          <p>Standardized photos with AR guidance: face, under-eyes, back of hand, tongue. Vision AI extracts discrete visual wellness signals.</p>
        </div>
        <div class="step-body">
          Conjunctival pallor, skin texture, nail ridging, lip dryness, under-eye darkness — <em>each observed with calibrated confidence.</em> The AI sees what a trained clinician's eye sees. Consistently. Every visit, every provider.
        </div>
      </div>

      <div class="step">
        <div class="step-num-wrap">02</div>
        <div class="step-head">
          <span class="step-tag">Question · 2m</span>
          <h3>Ask the right follow-ups.</h3>
          <p>The AI watches which patterns are emerging and chooses the next-best question to disambiguate.</p>
        </div>
        <div class="step-body">
          Not a twenty-item form. <em>Three to five targeted questions</em> your provider asks in conversation. Each one splits candidate patterns. When confidence crosses threshold, questioning stops.
        </div>
      </div>

      <div class="step">
        <div class="step-num-wrap">03</div>
        <div class="step-head">
          <span class="step-tag">Match · instant</span>
          <h3>Recommend from what you offer.</h3>
          <p>Your clinic's drip menu becomes the recommendation space.</p>
        </div>
        <div class="step-body">
          No pricing optimization. No packages. No seasonal promotions. The tool finds deficit signals and matches them to your catalog — the provider sees <em>rationale for every suggestion.</em>
        </div>
      </div>

      <div class="step">
        <div class="step-num-wrap">04</div>
        <div class="step-head">
          <span class="step-tag">Protect · flagged</span>
          <h3>Surface what matters.</h3>
          <p>Three-tier safety flag system. The tool identifies when a patient may need more than a drip.</p>
        </div>
        <div class="step-body">
          Informational, follow-up, and contraindication flags. <em>An assessment tool that knows when not to recommend</em> a drip is more trustworthy than one that always does — and protects your clinic.
        </div>
      </div>

      <div class="step">
        <div class="step-num-wrap">05</div>
        <div class="step-head">
          <span class="step-tag">Review · approved</span>
          <h3>Walk the patient through the results.</h3>
          <p>The provider reviews the assessment with the patient during the consult — right there, right then.</p>
        </div>
        <div class="step-body">
          Nothing reaches the patient until your provider approves it. <em>The conversation becomes clinical, not transactional.</em> Patients leave understanding why they're getting what they're getting.
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CONSISTENCY -->
<section class="section section--tinted reveal" id="consistency">
  <div class="section-inner">
    <div class="eyebrow">Consistency across your clinic</div>
    <h2 class="section-title">
      Every provider, every visit,<br>
      <em>the same level of care.</em>
    </h2>
    <p class="section-lead">
      DripWell standardizes how your team talks to patients about service. Same methodology. Same quality of conversation. Same clinical depth — <strong>whether the patient sees your senior nurse or a new hire on their third day.</strong>
    </p>

    <div class="consistency-grid">
      <div class="cons-visual">
        <div class="cons-visual-title">Assessment quality by provider</div>
        <div class="cons-providers">
          <div class="cons-provider">
            <div>
              <div class="cons-provider-name">Sarah, RN</div>
              <div class="cons-provider-sub">Senior · 4 years</div>
            </div>
            <div class="cons-bar">
              <div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div>
            </div>
            <div class="cons-tag">Consistent</div>
          </div>
          <div class="cons-provider">
            <div>
              <div class="cons-provider-name">Marcus, RN</div>
              <div class="cons-provider-sub">Mid · 18 months</div>
            </div>
            <div class="cons-bar">
              <div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div>
            </div>
            <div class="cons-tag">Consistent</div>
          </div>
          <div class="cons-provider">
            <div>
              <div class="cons-provider-name">Jamie, RN</div>
              <div class="cons-provider-sub">New hire · Day 3</div>
            </div>
            <div class="cons-bar">
              <div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div><div class="cons-bar-seg active"></div>
            </div>
            <div class="cons-tag">Consistent</div>
          </div>
        </div>
        <div class="cons-caption">Same assessment quality, regardless of tenure</div>
      </div>

      <div class="cons-points">
        <div class="cons-point">
          <span class="cons-point-num">01</span>
          <h4>One script, written by the evidence.</h4>
          <p>When every provider's recommendation is anchored in the same assessment output, every patient conversation sounds professional, consistent, and clinically grounded — whether they're seeing your best provider or your newest.</p>
        </div>
        <div class="cons-point">
          <span class="cons-point-num">02</span>
          <h4>New hires ramp in days, not months.</h4>
          <p>Training a new IV provider used to mean months of shadowing to build intuition for what to recommend. DripWell compresses that. The tool provides the clinical reasoning — your new hire provides the human touch.</p>
        </div>
        <div class="cons-point">
          <span class="cons-point-num">03</span>
          <h4>Revenue stops depending on who's on shift.</h4>
          <p>When recommendation quality is consistent, upsell acceptance, add-on attachment, and membership conversion all stabilize. Your average ticket becomes a number you can plan around — not a coin flip based on staffing.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- OUTCOMES -->
<section class="section reveal">
  <div class="section-inner">
    <div class="eyebrow">Better conversations, better outcomes</div>
    <h2 class="section-title">
      When recommendations come from evidence,<br>
      <em>everything changes.</em>
    </h2>
    <p class="section-lead">
      DripWell was built as a clinical tool, not a sales tool. But because every recommendation is backed by an objective, science-grounded assessment, <strong>commercial outcomes follow naturally.</strong>
    </p>

    <div class="outcomes-grid">
      <div class="outcome">
        <div class="outcome-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 17L17 7M17 7H10M17 7V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="outcome-tag">Drip upgrades</div>
        <h3>From the basic drip to the Myers'.</h3>
        <p>When the assessment shows a B-vitamin and mineral cluster, the provider isn't upselling — they're matching the drip to what the patient's body is showing. The patient sees the reasoning. They choose the better drip.</p>
      </div>

      <div class="outcome">
        <div class="outcome-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        <div class="outcome-tag">Add-on acceptance</div>
        <h3>Glutathione. B12. NAD+.</h3>
        <p>Add-ons stop being a pitch at checkout. They become the natural continuation of a clinical conversation. When DripWell identifies the signal pattern, the add-on is the logical next step — and patients accept it because it makes sense.</p>
      </div>

      <div class="outcome">
        <div class="outcome-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12C3 7.03 7.03 3 12 3C14.8 3 17.27 4.28 18.9 6.3L21 4.5V10.5H15L17.46 8.08C16.18 6.75 14.18 6 12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C14.98 18 17.44 15.84 17.9 13H20.93C20.44 17.47 16.63 21 12 21C7.03 21 3 16.97 3 12Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="outcome-tag">Memberships</div>
        <h3>A real reason to come back.</h3>
        <p>Most memberships feel like a discount pitch. DripWell's quarterly reassessment gives patients something tangible: their own progress, visible in their own signals over 90 days. Memberships become a plan, not a pitch.</p>
      </div>
    </div>
  </div>
</section>

<!-- SCIENCE -->
<section class="section section--tinted reveal" id="science">
  <div class="section-inner">
    <div class="eyebrow">The clinical foundation</div>
    <h2 class="section-title">
      AI is the method.<br>
      <em>Clinical research is the reason.</em>
    </h2>
    <p class="section-lead">
      DripWell isn't an AI skin analyzer repurposed for wellness. The assessment methodology has been used in clinical practice for over a decade. What's new is the ability to run it in your exam room, on a tablet, in minutes.
    </p>

    <div class="science-grid">
      <div class="science-pull">
        <div class="science-quote-mark">"</div>
        <div class="science-quote">
          Nutrition-Focused Physical Examination has been part of the Registered Dietitian scope of practice for more than ten years — a systematic head-to-toe examination of physical appearance and function to identify nutritional deficits.
        </div>
        <div class="science-source">— Academy of Nutrition and Dietetics · ASPEN</div>
      </div>

      <div class="credibility">
        <div class="cred-item">
          <div class="cred-num">01</div>
          <div>
            <h4>Built on NFPE methodology.</h4>
            <p>The same observational framework clinical dietitians use in hospital and outpatient settings — applied consistently by AI, in your clinic, every visit.</p>
          </div>
        </div>
        <div class="cred-item">
          <div class="cred-num">02</div>
          <div>
            <h4>Grounded in peer-reviewed literature.</h4>
            <p>Every signal the AI observes is tied to published clinical research on deficiency indicators — from Cleveland Clinic Journal of Medicine to ASPEN standards.</p>
          </div>
        </div>
        <div class="cred-item">
          <div class="cred-num">03</div>
          <div>
            <h4>Clinician-advised from inception.</h4>
            <p>Our clinical advisory board reviews the signal taxonomy, pattern library, and safety flags. AI proposes; clinicians validate.</p>
          </div>
        </div>
        <div class="cred-item">
          <div class="cred-num">04</div>
          <div>
            <h4>Vision AI from the research frontier.</h4>
            <p>Built on the same class of vision-language architecture being actively researched for clinical applications — including Google DeepMind's MedGemma project.</p>
          </div>
        </div>
        <div class="cred-item">
          <div class="cred-num">05</div>
          <div>
            <h4>Screening tool, stated plainly.</h4>
            <p>DripWell is an assessment instrument, not a diagnostic device. Blood work remains the gold standard. We fill the gap between anecdotal intake and full labs.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="section reveal" id="pricing">
  <div class="section-inner">
    <div class="eyebrow">Pricing</div>
    <h2 class="section-title">
      Pay for what you assess.<br>
      <em>Nothing you don't.</em>
    </h2>
    <p class="section-lead">
      Monthly plans priced by assessments run. Every tier includes every feature — unlimited providers, unlimited catalog edits, HIPAA compliance, BAA included. Busy month? Add a bundle instead of jumping a tier.
    </p>

    <div class="pricing-grid">
      <div class="tier">
        <div class="tier-name">Starter</div>
        <div class="tier-desc">Single-location, lower volume.</div>
        <div class="tier-count-wrap">
          <span class="tier-count">50</span>
          <span class="tier-unit">assessments<br>per month</span>
        </div>
        <ul class="tier-features">
          <li>Every feature, no gates</li>
          <li>Unlimited providers and catalog edits</li>
          <li>HIPAA-compliant, BAA included</li>
          <li>Email support</li>
          <li>Self-serve onboarding</li>
        </ul>
        <a href="#cta" class="tier-cta">Start with Starter</a>
      </div>

      <div class="tier tier--featured">
        <div class="tier-badge">Most chosen</div>
        <div class="tier-name">Growth</div>
        <div class="tier-desc">Established clinics or small multi-location.</div>
        <div class="tier-count-wrap">
          <span class="tier-count">150</span>
          <span class="tier-unit">assessments<br>per month</span>
        </div>
        <ul class="tier-features">
          <li>Everything in Starter</li>
          <li>Priority support</li>
          <li>Guided onboarding call</li>
          <li>Deeper analytics dashboard</li>
          <li>Quarterly clinical training refresher</li>
        </ul>
        <a href="#cta" class="tier-cta">Choose Growth</a>
      </div>

      <div class="tier">
        <div class="tier-name">Scale</div>
        <div class="tier-desc">Multi-location, franchise, or high-volume.</div>
        <div class="tier-count-wrap">
          <span class="tier-count">400</span>
          <span class="tier-unit">assessments<br>per month</span>
        </div>
        <ul class="tier-features">
          <li>Everything in Growth</li>
          <li>Dedicated success manager</li>
          <li>White-glove onboarding per location</li>
          <li>Cross-location analytics</li>
          <li>Custom training delivery</li>
        </ul>
        <a href="#cta" class="tier-cta">Talk to us</a>
      </div>
    </div>

    <div class="bundles">
      <div class="bundles-text">
        <h4>Busy month? Add a bundle.</h4>
        <p>Top up without changing tiers. Bundles never expire within your subscription term.</p>
      </div>
      <div class="bundle-chips">
        <span class="bundle-chip">+25</span>
        <span class="bundle-chip">+100</span>
        <span class="bundle-chip">+250</span>
      </div>
    </div>
  </div>
</section>

<!-- FINAL CTA -->
<section class="cta-final reveal" id="cta">
  <div class="cta-final-bg">
    <div class="blob blob-1" style="top: -200px; left: 10%;"></div>
    <div class="blob blob-2" style="bottom: -200px; right: 10%;"></div>
  </div>

  <div class="cta-final-inner">
    <h2>Stop guessing.<br><em>Start assessing.</em></h2>
    <p>Request early access. We'll walk you through the product, answer questions on clinical grounding, and get your clinic set up in about thirty minutes.</p>
    <div class="cta-final-row">
      <a href="mailto:hello@dripwell.ai" class="btn-primary">
        Request early access
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true"><path d="M1 6H13M13 6L8 1M13 6L8 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <a href="#science" class="btn-ghost">Read the science</a>
    </div>
  </div>
</section>

<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <a href="#" class="brand">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 3C16 3 7 15.2 7 21C7 25.9706 11.0294 30 16 30C20.9706 30 25 25.9706 25 21C25 15.2 16 3 16 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="16" cy="22" r="3" fill="currentColor"/>
          </svg>
        </div>
        DripWell
      </a>
      <p>DripWell is an AI-powered in-room wellness assessment built for IV therapy clinics. Grounded in published clinical methodology. Designed to make your consultations better — not to sell your patients something.</p>
    </div>
    <div class="footer-col">
      <h5>Product</h5>
      <a href="#spectrum">Spectrum</a>
      <a href="#how">How it works</a>
      <a href="#consistency">Consistency</a>
      <a href="#science">Science</a>
      <a href="#pricing">Pricing</a>
    </div>
    <div class="footer-col">
      <h5>Company</h5>
      <a href="#">About</a>
      <a href="#">Clinical advisors</a>
      <a href="#">Press</a>
      <a href="#">Contact</a>
    </div>
    <div class="footer-col">
      <h5>Legal</h5>
      <a href="#">Privacy</a>
      <a href="#">Terms</a>
      <a href="#">HIPAA</a>
      <a href="#">BAA</a>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 DripWell · All rights reserved</span>
    <span>Screening tool only. Not a medical device. Does not diagnose, treat, cure, or prevent disease.</span>
  </div>
</footer>
`;

  // Nav scroll behavior
  const nav = document.getElementById('mainNav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 24) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // IntersectionObserver for reveals
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
  );
  container.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
