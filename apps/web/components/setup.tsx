'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emptyConsultationSummary, type ClinicConfiguration } from '@dripwell/shared/v2';
import { apiRequest, isOwner, postJson, useClinic } from './clinic-context';
import { AudioRecorder } from './audio-recorder';
import {
  CatalogEditor,
  emptyConfiguration,
  QuestionsEditor,
  SyntheticIntake,
} from './configuration-editor';
import { waitForJob } from './job-client';
import { Badge, Celebrate, ErrorBanner, Icon, Modal, Money, friendlyDate } from './ui';

interface Proposal {
  clinicName: string | null;
  currency: string | null;
  products: {
    name: string;
    type: ClinicConfiguration['products'][number]['type'];
    priceCents: number | null;
    currency: string | null;
    description: string;
    ingredients: { name: string; quantity: string | null }[];
    benefits: string[];
    terms: string;
    sourceQuote: string;
    gaps: string[];
  }[];
  questions: { text: string; why: string; sourceQuote: string }[];
  protocolNotes: string[];
  missingQuestions: string[];
}
interface SetupResponse {
  conversationId: string;
  assistantMessage?: string;
  draft?: Proposal | null;
  missingQuestions?: string[];
  jobId?: string;
}
interface ChatMessage {
  id: string;
  role: string;
  text: string;
}

function SetupAssistant({
  onProposal,
  locationId,
}: {
  onProposal: (proposal: Proposal | null) => void;
  locationId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [readiness, setReadiness] = useState<boolean | null>(null);
  const requestKey = useRef<string | null>(null);
  const lastMessage = useRef<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const conversationRef = useRef(conversationId);
  conversationRef.current = conversationId;
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setConversationId(undefined);
    setMessages([]);
    setMissing([]);
    onProposal(null);
    setError('');
    requestKey.current = null;
    lastMessage.current = null;
    if (!locationId) return;
    let current = true;
    void apiRequest<{
      conversation: { id: string; messages: ChatMessage[]; draft: Proposal | null } | null;
      readiness?: {
        ready?: boolean;
        configured?: boolean;
        gatewayConfigured?: boolean;
        privateStorageConfigured?: boolean;
      };
    }>(`/api/setup?locationId=${encodeURIComponent(locationId)}`)
      .then((result) => {
        if (!current) return;
        if (result.conversation) {
          setConversationId(result.conversation.id);
          setMessages(result.conversation.messages || []);
          if (result.conversation.draft) {
            onProposal(result.conversation.draft);
            setMissing(result.conversation.draft.missingQuestions || []);
          }
        }
        setReadiness(
          result.readiness?.ready ??
            result.readiness?.configured ??
            (result.readiness
              ? Boolean(
                  result.readiness.gatewayConfigured && result.readiness.privateStorageConfigured,
                )
              : null),
        );
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Unable to reopen setup conversation.'),
      );
    return () => {
      current = false;
    };
  }, [locationId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [messages, busy]);
  function accept(result: SetupResponse) {
    if (!alive.current) return;
    setConversationId(result.conversationId);
    if (result.assistantMessage)
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), role: 'assistant', text: result.assistantMessage! },
      ]);
    if (result.draft) onProposal(result.draft);
    setMissing(result.missingQuestions || result.draft?.missingQuestions || []);
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    if (lastMessage.current !== message.trim()) {
      lastMessage.current = message.trim();
      requestKey.current = crypto.randomUUID();
      setMessages((items) => [
        ...items,
        { id: requestKey.current!, role: 'user', text: message.trim() },
      ]);
    }
    try {
      let result = await postJson<SetupResponse>('/api/setup', {
        message: message.trim(),
        conversationId,
        locationId,
        idempotencyKey: requestKey.current,
      });
      if (result.jobId) result = (await waitForJob(result.jobId)) as unknown as SetupResponse;
      accept(result);
      setMessage('');
      requestKey.current = null;
      lastMessage.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Assistant unavailable. Your message is preserved for retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File, purpose: 'voice' | 'catalog') {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('purpose', purpose);
      body.set('locationId', locationId);
      if (conversationRef.current) body.set('conversationId', conversationRef.current);
      if (purpose === 'voice') body.set('consent', 'true');
      const result = await apiRequest<{ jobId: string; conversationId?: string }>(
        '/api/setup/upload',
        { method: 'POST', body },
      );
      if (result.conversationId) setConversationId(result.conversationId);
      const output = await waitForJob(result.jobId);
      if (!alive.current) return;
      if (typeof output.conversationId === 'string') setConversationId(output.conversationId);
      if (typeof output.transcript === 'string') {
        setMessage(output.transcript);
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Your voice message is transcribed below. Review it, then send it to the setup assistant.',
          },
        ]);
      }
      if (output.draft) {
        onProposal(output.draft as unknown as Proposal);
        setMissing((output.missingQuestions as string[]) || []);
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'I organized the uploaded catalog into a proposal. Review the source and any gaps before adding items to your draft.',
          },
        ]);
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Upload could not be processed.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="setup-assistant">
      <div className="assistant-title">
        <span>
          <Icon name="spark" size={19} />
        </span>
        <div>
          <h3>Your setup assistant</h3>
          <p>Tell it what your clinic offers.</p>
        </div>
      </div>
      <p className="small muted">
        Share catalog details, prices and clinic processes. The assistant organizes proposals; only
        you can save, test and activate them.
      </p>
      {readiness === false ? (
        <div className="notice notice-warm">
          AI services need to be connected. You can complete setup using the editable forms.
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      <div className="chat-messages" ref={scrollRef}>
        {messages.length ? (
          messages.map((item) => (
            <div className={`chat-message ${item.role}`} key={item.id}>
              <span>{item.role === 'user' ? 'You' : 'Setup assistant'}</span>
              {item.text}
            </div>
          ))
        ) : (
          <div className="chat-message assistant">
            <span>Setup assistant</span>Start with your clinic&apos;s catalog, official prices and
            memberships. I&apos;ll help organize what you provide and ask about gaps.
          </div>
        )}
        {busy ? (
          <div className="chat-message assistant" role="status">
            Working with what you shared…
          </div>
        ) : null}
      </div>
      <form className="chat-compose" onSubmit={(event) => void send(event)}>
        <textarea
          aria-label="Message the setup assistant"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tell me about your IVs, add-ons, memberships…"
          rows={3}
        />
        <button
          className="button button-primary"
          disabled={busy || !message.trim()}
          aria-label="Send setup message"
        >
          <Icon name="arrow" size={18} />
        </button>
      </form>
      {missing.length ? (
        <div className="test-result">
          <h3>Details still needed</h3>
          {missing.map((item, index) => (
            <p key={index}>{item}</p>
          ))}
        </div>
      ) : null}
      <div className="assistant-upload">
        <label>
          Upload your menu, photo or catalog
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file, 'catalog').catch(() => {});
              event.target.value = '';
            }}
          />
        </label>
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={voiceConsent}
          onChange={(event) => setVoiceConsent(event.target.checked)}
        />
        I agree to transcribe my setup voice message.
      </label>
      <AudioRecorder
        consented={voiceConsent && !busy}
        continuous={false}
        label="Voice message"
        onSegment={async (file) => upload(file, 'voice')}
      />
    </aside>
  );
}

export function Setup() {
  const { data, mutate, locationId } = useClinic();
  const [configuration, setConfiguration] = useState<ClinicConfiguration | null>(null);
  const [tab, setTab] = useState('catalog');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testSummary, setTestSummary] = useState(emptyConsultationSummary);
  const [testNotes, setTestNotes] = useState('');
  const [approvedTests, setApprovedTests] = useState<string[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const draft = data?.configuration.draft;
  const active = data?.configuration.active;
  useEffect(() => {
    if (data) {
      setConfiguration(
        structuredClone(
          draft?.configuration || active?.configuration || emptyConfiguration(data.clinic.name),
        ),
      );
      setApprovedTests([]);
    }
  }, [draft?.id, draft?.revision, active?.id, data?.clinic.name]);
  const unsaved = configuration
    ? JSON.stringify(configuration) !==
      JSON.stringify(
        draft?.configuration ||
          active?.configuration ||
          emptyConfiguration(data?.clinic.name || ''),
      )
    : false;
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (unsaved) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);
  if (!data || !configuration) return null;
  if (!isOwner(data.user.role))
    return (
      <div className="readonly-note">
        Clinic configuration is managed by the owner. Your team can review approved clinic guidance
        during consultations.
      </div>
    );
  async function act(action: string, fields: Record<string, unknown>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await mutate(action, fields);
      setNotice(success);
      if (action === 'config.activate') setCelebrate(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save configuration.');
    } finally {
      setBusy(false);
    }
  }
  function changePolicy(
    field: keyof ClinicConfiguration['recommendationPolicy'],
    value: string | number | boolean,
  ) {
    setConfiguration((current) =>
      current
        ? { ...current, recommendationPolicy: { ...current.recommendationPolicy, [field]: value } }
        : current,
    );
  }
  function addProposedProduct(index: number) {
    if (!proposal) return;
    const item = proposal.products[index]!;
    setConfiguration((current) =>
      current
        ? {
            ...current,
            products: [
              ...current.products,
              {
                id: crypto.randomUUID(),
                name: item.name,
                type: item.type,
                description: item.description,
                priceCents: item.priceCents,
                currency: item.currency || current.clinic.currency,
                available: true,
                ingredients: item.ingredients.map((ingredient) => ({
                  name: ingredient.name,
                  quantity: ingredient.quantity || '',
                })),
                goalTags: [],
                compatibleWith: [],
                benefits: item.benefits,
                terms: item.terms,
                clinical: !['SERVICE', 'MEMBERSHIP'].includes(item.type),
                rules: {
                  validated: false,
                  validationNote: '',
                  eligibility: [],
                  exclusions: [],
                  rationale: '',
                },
                priority: 0,
              },
            ],
          }
        : current,
    );
  }
  return (
    <>
      <Celebrate active={celebrate} onEnd={() => setCelebrate(false)} />
      <div className="page-heading">
        <div>
          <div className="eyebrow">SET YOUR STANDARD</div>
          <h1>Your clinic, thoughtfully configured.</h1>
          <p>Official offerings, clear questions and durable rules your team can trust.</p>
        </div>
        <Link className="button" href="/account">
          <Icon name="shield" size={16} />
          Owner security
        </Link>
      </div>
      <div className="configuration-bar">
        <div>
          <Badge tone={active ? 'green' : 'amber'}>
            {active ? `Active v${active.version}` : 'Not yet active'}
          </Badge>
          <span>
            {draft
              ? `Draft v${draft.version} · revision ${draft.revision}`
              : 'Create your next draft'}
          </span>
          {unsaved ? <Badge tone="amber">Unsaved changes</Badge> : null}
        </div>
        <button
          className="button button-small button-primary"
          disabled={busy}
          onClick={() =>
            void act(
              'config.saveDraft',
              {
                configuration,
                locationId: locationId || data.locations[0]?.id,
                ...(draft
                  ? { configurationVersionId: draft.id, expectedVersion: draft.revision }
                  : {}),
                source: 'Owner reviewed settings',
              },
              'Draft saved. Active clinic guidance stays unchanged until you test and activate it.',
            )
          }
        >
          <Icon name="check" size={14} />
          {busy ? 'Saving…' : 'Save draft'}
        </button>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <div className="notice notice-subtle" role="status">
          <Icon name="check" size={17} />
          {notice}
        </div>
      ) : null}
      <div className="setup-layout">
        <div className="setup-editor">
          <div className="editor-tabs" role="tablist" aria-label="Clinic configuration sections">
            {[
              { id: 'catalog', label: 'Catalog & prices' },
              { id: 'questions', label: 'Questions' },
              { id: 'policy', label: 'Clinic & protocols' },
              { id: 'test', label: 'Test & activate' },
              { id: 'versions', label: 'Version history' },
            ].map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? 'selected' : ''}
                onClick={() => setTab(item.id)}
                role="tab"
                aria-selected={tab === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          {proposal ? (
            <div className="notice notice-subtle">
              <Icon name="spark" size={18} />
              <div>
                <strong>An assistant proposal is ready for review.</strong>
                <p>
                  {proposal.products.length} catalog items · {proposal.questions.length} possible
                  questions · {proposal.missingQuestions.length} gaps
                </p>
              </div>
              <button className="button button-small" onClick={() => setProposalOpen(true)}>
                Review proposal
              </button>
            </div>
          ) : null}
          <section className="panel">
            {tab === 'catalog' ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Your actual offerings</h2>
                    <p>
                      Prices are stored exactly in the currency’s smallest unit. Every clinical item
                      needs validated clinic rules before activation.
                    </p>
                  </div>
                  <Badge>{configuration.products.length} items</Badge>
                </div>
                <CatalogEditor configuration={configuration} onChange={setConfiguration} />
              </>
            ) : tab === 'questions' ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>A better conversation starts here.</h2>
                    <p>
                      Staff see these questions and why they matter. Required answers gate clinical
                      approval.
                    </p>
                  </div>
                </div>
                <QuestionsEditor configuration={configuration} onChange={setConfiguration} />
              </>
            ) : tab === 'policy' ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Clinic details and protocols</h2>
                    <p>
                      Keep clinical suitability separate from wellness offers and commercial
                      outcomes.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Clinic display name
                    <input
                      value={configuration.clinic.name}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          clinic: { ...configuration.clinic, name: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Official currency
                    <input
                      value={configuration.clinic.currency}
                      maxLength={3}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          clinic: {
                            ...configuration.clinic,
                            currency: event.target.value.toUpperCase(),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Contact for client takeaways
                    <input
                      value={configuration.clinic.contact}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          clinic: { ...configuration.clinic, contact: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Clinic brand color
                    <input
                      type="color"
                      value={configuration.clinic.brandColor}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          clinic: { ...configuration.clinic, brandColor: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    Maximum initial add-ons
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={configuration.recommendationPolicy.maxAddOns}
                      onChange={(event) => changePolicy('maxAddOns', Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Maximum wellness offers
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={configuration.recommendationPolicy.maxWellnessOffers}
                      onChange={(event) =>
                        changePolicy('maxWellnessOffers', Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Clinical validator / protocol authority
                    <input
                      value={configuration.recommendationPolicy.validatedBy}
                      onChange={(event) => changePolicy('validatedBy', event.target.value)}
                    />
                  </label>
                  <label>
                    Clinical validation reference
                    <textarea
                      value={configuration.recommendationPolicy.validationNote}
                      rows={2}
                      onChange={(event) => changePolicy('validationNote', event.target.value)}
                    />
                  </label>
                </div>
                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={configuration.recommendationPolicy.clinicalValidated}
                    onChange={(event) => changePolicy('clinicalValidated', event.target.checked)}
                  />
                  <span>
                    <strong>Our recommendation policy has appropriate clinical validation.</strong>
                    <small>
                      Use your medical director&apos;s approved protocols. AI conversations cannot
                      establish or override clinical validation.
                    </small>
                  </span>
                </label>
                <h3 className="form-heading">Persistent reminder timing</h3>
                <div className="form-grid">
                  <label>
                    Care outcome reminder after (hours)
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={configuration.reminders.careOutcomeHours}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          reminders: {
                            ...configuration.reminders,
                            careOutcomeHours: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Wellness decision reminder after (hours)
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={configuration.reminders.wellnessDecisionHours}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          reminders: {
                            ...configuration.reminders,
                            wellnessDecisionHours: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <h3 className="form-heading">Retention and sharing settings</h3>
                <p className="field-help">
                  Review these proposed defaults against your clinic&apos;s retention obligations
                  before activation.
                </p>
                <div className="form-grid">
                  <label>
                    Audio retention (days)
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={configuration.retention.audioDays}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          retention: {
                            ...configuration.retention,
                            audioDays: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Document retention (days)
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={configuration.retention.documentDays}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          retention: {
                            ...configuration.retention,
                            documentDays: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Default share link expiry (hours)
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={configuration.retention.shareExpiryHours}
                      onChange={(event) =>
                        setConfiguration({
                          ...configuration,
                          retention: {
                            ...configuration.retention,
                            shareExpiryHours: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </>
            ) : tab === 'test' ? (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Try it before your team uses it.</h2>
                    <p>
                      Test several synthetic cases, including missing facts and unsuitable options.
                      Review results before activation.
                    </p>
                  </div>
                </div>
                {!draft ? (
                  <div className="notice notice-warm">Save your draft before running a test.</div>
                ) : unsaved ? (
                  <div className="notice notice-warm">
                    Save your changes first. Tests must run against the exact saved draft.
                  </div>
                ) : null}
                <SyntheticIntake
                  configuration={configuration}
                  summary={testSummary}
                  onChange={setTestSummary}
                />
                <label style={{ marginTop: 16 }}>
                  Test notes
                  <input
                    value={testNotes}
                    onChange={(event) => setTestNotes(event.target.value)}
                    placeholder="What should this case demonstrate?"
                  />
                </label>
                <button
                  className="button"
                  disabled={busy || !draft || unsaved}
                  onClick={() =>
                    draft &&
                    void act(
                      'config.test',
                      {
                        configurationVersionId: draft.id,
                        expectedVersion: draft.revision,
                        summary: testSummary,
                        notes: testNotes,
                      },
                      'Synthetic test saved. Review the result below.',
                    )
                  }
                >
                  <Icon name="spark" size={16} />
                  Run synthetic test
                </button>
                {draft?.tests?.map((test) => (
                  <div className="test-result" key={test.id}>
                    <div className="section-heading">
                      <h3>{test.notes || `Test from ${friendlyDate(test.testedAt)}`}</h3>
                      <Badge tone={test.initial.blocked ? 'amber' : 'green'}>
                        {test.initial.blocked
                          ? 'Clinical approval blocked'
                          : 'Eligible options found'}
                      </Badge>
                    </div>
                    {test.initial.items.map((item) => (
                      <p key={item.productId}>
                        <strong>{item.name}</strong> ·{' '}
                        <Money cents={item.priceCents} currency={item.currency} /> ·{' '}
                        {item.rationale}
                      </p>
                    ))}
                    <p>{test.initial.explanation}</p>
                    {test.initial.safetyFlags.map((flag, index) => (
                      <p key={index}>{flag}</p>
                    ))}
                    {test.initial.unresolvedQuestions.map((question) => (
                      <p key={question.questionId}>Missing: {question.text}</p>
                    ))}
                    <label className="checkbox-card">
                      <input
                        type="checkbox"
                        checked={approvedTests.includes(test.id)}
                        onChange={(event) =>
                          setApprovedTests((ids) =>
                            event.target.checked
                              ? [...ids, test.id]
                              : ids.filter((id) => id !== test.id),
                          )
                        }
                      />
                      <span>
                        <strong>I reviewed this result against our clinic protocols.</strong>
                      </span>
                    </label>
                  </div>
                ))}
                <div className="panel-actions">
                  <Link className="text-button" href="/account">
                    Owner MFA is required to publish
                  </Link>
                  <button
                    className="button button-primary"
                    disabled={busy || !draft || unsaved || !approvedTests.length}
                    onClick={() =>
                      draft &&
                      void act(
                        'config.activate',
                        {
                          configurationVersionId: draft.id,
                          expectedVersion: draft.revision,
                          approvedTestIds: approvedTests,
                        },
                        'Clinic configuration activated. Your team is ready to start new consultations.',
                      )
                    }
                  >
                    <Icon name="check" size={16} />
                    Activate reviewed configuration
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Durable guidance, with a clear history.</h2>
                    <p>
                      New visits use the active version. Existing visits preserve their own catalog
                      and price snapshots.
                    </p>
                  </div>
                </div>
                {data.configuration.versions.length ? (
                  data.configuration.versions.map((version) => (
                    <div className="version-card" key={version.id}>
                      <span className="item-icon">
                        <Icon name="file" />
                      </span>
                      <div>
                        <h3>
                          Configuration v{version.version}{' '}
                          <Badge tone={version.status === 'ACTIVE' ? 'green' : 'neutral'}>
                            {version.status.toLowerCase()}
                          </Badge>
                        </h3>
                        <p>
                          {version.source} · {friendlyDate(version.createdAt)} ·{' '}
                          {version.configuration.products.length} items
                        </p>
                      </div>
                      {version.status !== 'ACTIVE' &&
                      !['DRAFT', 'TESTED'].includes(version.status) ? (
                        <button
                          className="button button-small"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              'config.rollback',
                              {
                                configurationVersionId: version.id,
                                locationId: locationId || data.locations[0]?.id,
                              },
                              `Active configuration rolled back to version ${version.version}.`,
                            )
                          }
                        >
                          Restore this version
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="muted">Your first saved draft will begin the version history.</p>
                )}
              </>
            )}
          </section>
        </div>
        <SetupAssistant key={locationId} onProposal={setProposal} locationId={locationId} />
      </div>
      <Modal
        open={proposalOpen}
        onClose={() => setProposalOpen(false)}
        title="Review the assistant's proposal"
      >
        <p className="small muted">
          Check source quotes, official prices and gaps. Adding an item only changes your working
          draft; clinical validation remains unset.
        </p>
        {proposal?.products.map((product, index) => {
          const exists = configuration.products.some(
            (item) => item.name === product.name && item.type === product.type,
          );
          return (
            <div className="catalog-card" key={`${product.name}-${index}`}>
              <div className="catalog-card-top">
                <div>
                  <h3>{product.name}</h3>
                  <Badge>{product.type.toLowerCase()}</Badge>
                </div>
                <Money
                  cents={product.priceCents}
                  currency={product.currency || configuration.clinic.currency}
                />
              </div>
              <p>{product.description}</p>
              {product.sourceQuote ? (
                <p className="evidence">Source: “{product.sourceQuote}”</p>
              ) : null}
              {product.gaps.map((gap, gapIndex) => (
                <p className="error-text" key={gapIndex}>
                  {gap}
                </p>
              ))}
              <button
                className="button button-small"
                disabled={exists}
                onClick={() => addProposedProduct(index)}
              >
                {exists ? 'Already in draft' : 'Add to working draft'}
              </button>
            </div>
          );
        })}
        {proposal?.questions.map((question, index) => (
          <div className="catalog-card" key={`${question.text}-${index}`}>
            <h3>{question.text}</h3>
            <p>{question.why}</p>
            {question.sourceQuote ? (
              <p className="evidence">Source: “{question.sourceQuote}”</p>
            ) : null}
            <button
              className="button button-small"
              disabled={configuration.questions.some((item) => item.text === question.text)}
              onClick={() =>
                setConfiguration({
                  ...configuration,
                  questions: [
                    ...configuration.questions,
                    {
                      id: crypto.randomUUID(),
                      text: question.text,
                      why: question.why,
                      type: 'TEXT',
                      options: [],
                      required: false,
                      safetyRelevant: false,
                      activeWhen: [],
                      priority: 0,
                    },
                  ],
                })
              }
            >
              Add question for review
            </button>
          </div>
        ))}
        {proposal?.protocolNotes.length ? (
          <div className="notice notice-warm">
            <div>
              <strong>Protocol notes needing clinical review</strong>
              {proposal.protocolNotes.map((note, index) => (
                <p key={index}>{note}</p>
              ))}
            </div>
          </div>
        ) : null}
        <div className="modal-actions">
          <button className="button button-primary" onClick={() => setProposalOpen(false)}>
            Continue reviewing draft
          </button>
        </div>
      </Modal>
    </>
  );
}
