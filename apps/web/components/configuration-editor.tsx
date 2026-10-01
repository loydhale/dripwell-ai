'use client';

import { useEffect, useState } from 'react';
import type {
  CatalogProduct,
  ClinicConfiguration,
  ClinicQuestion,
  ConsultationSummary,
  RuleCondition,
} from '@dripwell/shared/v2';
import { currencyMinorUnitDigits, parsePriceToMinorUnits } from '@dripwell/shared/v2';
import { Badge, EmptyState, Icon, Modal, Money } from './ui';

export function emptyConfiguration(name: string): ClinicConfiguration {
  return {
    schemaVersion: 2,
    clinic: { name, currency: 'USD', contact: '', brandColor: '#1a776f' },
    questions: [],
    products: [],
    recommendationPolicy: {
      clinicalValidated: false,
      validatedBy: '',
      validationNote: '',
      maxAddOns: 2,
      maxWellnessOffers: 2,
    },
    reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 },
    retention: { audioDays: 7, documentDays: 365, shareExpiryHours: 48 },
  };
}

function list(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
export function parsePrice(value: string, currency = 'USD') {
  if (!value.trim()) return null;
  const minor = parsePriceToMinorUnits(value, currency);
  if (minor > 100000000) throw new Error('The price is outside the supported range.');
  return minor;
}

export function decimalPrice(amountMinor: number, currency: string) {
  const digits = currencyMinorUnitDigits(currency);
  return (amountMinor / 10 ** digits).toFixed(digits);
}

export function RulesEditor({
  value,
  questions,
  onChange,
  label,
}: {
  value: RuleCondition[];
  questions: ClinicQuestion[];
  onChange: (rules: RuleCondition[]) => void;
  label: string;
}) {
  function update(index: number, patch: Partial<RuleCondition>) {
    onChange(value.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }
  function parseRuleValue(questionId: string, operator: RuleCondition['operator'], raw: string) {
    if (operator === 'IN')
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    const question = questions.find((item) => item.id === questionId);
    if (question?.type === 'BOOLEAN') return raw === 'true' || raw.toLowerCase() === 'yes';
    if (question?.type === 'NUMBER') return raw === '' ? 0 : Number(raw);
    return raw;
  }
  return (
    <div className="rules-editor">
      <div className="catalog-heading">
        <h3>{label}</h3>
        <button
          className="text-button"
          type="button"
          disabled={!questions.length}
          onClick={() =>
            onChange([
              ...value,
              {
                questionId: questions[0]!.id,
                operator: 'EQ',
                value: questions[0]?.type === 'BOOLEAN' ? true : '',
              },
            ])
          }
        >
          <Icon name="plus" size={13} />
          Add condition
        </button>
      </div>
      {value.map((rule, index) => (
        <div className="rule-row" key={index}>
          <label>
            Question
            <select
              value={rule.questionId}
              onChange={(event) =>
                update(index, {
                  questionId: event.target.value,
                  value:
                    questions.find((item) => item.id === event.target.value)?.type === 'BOOLEAN'
                      ? true
                      : '',
                })
              }
            >
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.text}
                </option>
              ))}
            </select>
          </label>
          <label>
            Condition
            <select
              value={rule.operator}
              onChange={(event) =>
                update(index, { operator: event.target.value as RuleCondition['operator'] })
              }
            >
              <option value="EQ">Equals</option>
              <option value="NEQ">Not equal</option>
              <option value="CONTAINS">Contains</option>
              <option value="IN">One of</option>
              <option value="GTE">At least</option>
              <option value="LTE">At most</option>
            </select>
          </label>
          <label>
            Value
            {questions.find((item) => item.id === rule.questionId)?.type === 'BOOLEAN' &&
            rule.operator !== 'IN' ? (
              <select
                value={String(rule.value)}
                onChange={(event) => update(index, { value: event.target.value === 'true' })}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                value={Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
                onChange={(event) =>
                  update(index, {
                    value: parseRuleValue(rule.questionId, rule.operator, event.target.value),
                  })
                }
                placeholder={rule.operator === 'IN' ? 'Comma-separated values' : 'Expected answer'}
              />
            )}
          </label>
          <button
            className="icon-button"
            type="button"
            aria-label={`Remove condition ${index + 1}`}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      {!value.length ? (
        <p className="field-help">
          {questions.length
            ? "No conditions. Clinical rules must be reviewed against your clinic's validated protocols."
            : 'Add questions first to build conditions.'}
        </p>
      ) : (
        <p className="field-help">
          All eligibility conditions must match. Any exclusion condition blocks the item.
        </p>
      )}
    </div>
  );
}

export function CatalogEditor({
  configuration,
  onChange,
}: {
  configuration: ClinicConfiguration;
  onChange: (configuration: ClinicConfiguration) => void;
}) {
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  function open(product?: CatalogProduct) {
    setIsNew(!product);
    setError('');
    setPrice(product?.priceCents == null ? '' : decimalPrice(product.priceCents, product.currency));
    setEditing(
      product
        ? structuredClone(product)
        : {
            id: crypto.randomUUID(),
            name: '',
            type: 'DRIP',
            description: '',
            priceCents: null,
            currency: configuration.clinic.currency,
            available: true,
            ingredients: [],
            goalTags: [],
            compatibleWith: [],
            benefits: [],
            terms: '',
            clinical: true,
            rules: {
              validated: false,
              validationNote: '',
              eligibility: [],
              exclusions: [],
              rationale: '',
            },
            priority: 0,
          },
    );
  }
  function save() {
    if (!editing) return;
    try {
      if (!editing.name.trim()) throw new Error('Give this item a name.');
      const item = {
        ...editing,
        name: editing.name.trim(),
        priceCents: parsePrice(price, editing.currency),
      };
      onChange({
        ...configuration,
        products: isNew
          ? [...configuration.products, item]
          : configuration.products.map((product) => (product.id === item.id ? item : product)),
      });
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update item.');
    }
  }
  const visible = configuration.products.filter(
    (product) => filter === 'all' || product.type === filter,
  );
  return (
    <>
      <div className="catalog-heading">
        <select
          aria-label="Catalog type"
          style={{ width: 170 }}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All catalog items</option>
          <option value="DRIP">IV drips</option>
          <option value="ADD_ON">Add-ons</option>
          <option value="INJECTION">Injections</option>
          <option value="PEPTIDE">Peptides</option>
          <option value="SERVICE">Services</option>
          <option value="MEMBERSHIP">Memberships</option>
        </select>
        <button className="button button-small" onClick={() => open()}>
          <Icon name="plus" size={15} />
          Add an item
        </button>
      </div>
      {visible.length ? (
        visible.map((product) => (
          <div className="catalog-card" key={product.id}>
            <div className="catalog-card-top">
              <span className="item-icon">
                <Icon
                  name={
                    product.type === 'MEMBERSHIP'
                      ? 'card'
                      : product.type === 'SERVICE'
                        ? 'spark'
                        : 'pulse'
                  }
                />
              </span>
              <div>
                <h3>{product.name}</h3>
                <Badge>{product.type.replace('_', ' ').toLowerCase()}</Badge>
              </div>
              <Money cents={product.priceCents} currency={product.currency} />
              <button className="button button-small button-ghost" onClick={() => open(product)}>
                Edit
              </button>
            </div>
            <p>{product.description || 'Description not supplied.'}</p>
            <div className="catalog-card-bottom">
              <Badge tone={product.available ? 'green' : 'neutral'}>
                {product.available ? 'Available' : 'Unavailable'}
              </Badge>
              {product.clinical ? (
                <Badge tone={product.rules.validated ? 'teal' : 'amber'}>
                  {product.rules.validated ? 'Protocol validated' : 'Clinical validation needed'}
                </Badge>
              ) : (
                <Badge>Wellness offer</Badge>
              )}
              {product.priceCents == null ? (
                <Badge tone="amber">Official price needed</Badge>
              ) : null}
              {product.ingredients.length ? (
                <span className="small muted">
                  {product.ingredients
                    .map(
                      (ingredient) =>
                        `${ingredient.name}${ingredient.quantity ? ` (${ingredient.quantity})` : ''}`,
                    )
                    .join(' · ')}
                </span>
              ) : null}
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          icon="pulse"
          title="Build your clinic's official catalog."
          action={
            <button className="button button-small" onClick={() => open()}>
              <Icon name="plus" size={15} />
              Add an item
            </button>
          }
        >
          Add the IVs, add-ons, services and memberships you actually offer. Unknown prices remain
          incomplete until you confirm them.
        </EmptyState>
      )}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={isNew ? 'Add a catalog item' : 'Edit catalog item'}
      >
        {editing ? (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            {error ? (
              <p className="error-text" role="alert">
                {error}
              </p>
            ) : null}
            <div className="form-grid">
              <label>
                Item name
                <input
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                  required
                  maxLength={200}
                />
              </label>
              <label>
                Type
                <select
                  value={editing.type}
                  onChange={(event) => {
                    const type = event.target.value as CatalogProduct['type'];
                    setEditing({
                      ...editing,
                      type,
                      clinical: !['MEMBERSHIP', 'SERVICE'].includes(type),
                    });
                  }}
                >
                  {['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE', 'SERVICE', 'MEMBERSHIP'].map(
                    (type) => (
                      <option key={type}>{type}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Official price
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="Leave unknown prices blank"
                />
              </label>
              <label>
                Currency
                <input
                  value={editing.currency}
                  maxLength={3}
                  onChange={(event) =>
                    setEditing({ ...editing, currency: event.target.value.toUpperCase() })
                  }
                  pattern="[A-Z]{3}"
                  required
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                rows={3}
              />
            </label>
            <div className="form-grid">
              <label>
                Goal tags, one per line
                <textarea
                  rows={2}
                  value={editing.goalTags.join('\n')}
                  onChange={(event) =>
                    setEditing({ ...editing, goalTags: list(event.target.value) })
                  }
                />
              </label>
              <label>
                Benefits, one per line
                <textarea
                  rows={2}
                  value={editing.benefits.join('\n')}
                  onChange={(event) =>
                    setEditing({ ...editing, benefits: list(event.target.value) })
                  }
                />
              </label>
            </div>
            <label>
              Terms and membership details
              <textarea
                value={editing.terms}
                rows={3}
                onChange={(event) => setEditing({ ...editing, terms: event.target.value })}
              />
            </label>
            <fieldset>
              <legend>Ingredients and quantities</legend>
              {editing.ingredients.map((ingredient, index) => (
                <div
                  className="rule-row"
                  style={{ gridTemplateColumns: '1fr 1fr 30px' }}
                  key={index}
                >
                  <label>
                    Name
                    <input
                      value={ingredient.name}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          ingredients: editing.ingredients.map((entry, position) =>
                            position === index ? { ...entry, name: event.target.value } : entry,
                          ),
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      value={ingredient.quantity}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          ingredients: editing.ingredients.map((entry, position) =>
                            position === index ? { ...entry, quantity: event.target.value } : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Remove ingredient"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        ingredients: editing.ingredients.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setEditing({
                    ...editing,
                    ingredients: [...editing.ingredients, { name: '', quantity: '' }],
                  })
                }
              >
                <Icon name="plus" size={14} />
                Add ingredient
              </button>
            </fieldset>
            <fieldset>
              <legend>Compatible catalog items</legend>
              <div className="checkbox-options">
                {configuration.products
                  .filter((product) => product.id !== editing.id)
                  .map((product) => (
                    <label key={product.id}>
                      <input
                        type="checkbox"
                        checked={editing.compatibleWith.includes(product.id)}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            compatibleWith: event.target.checked
                              ? [...editing.compatibleWith, product.id]
                              : editing.compatibleWith.filter((id) => id !== product.id),
                          })
                        }
                      />
                      {product.name}
                    </label>
                  ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={editing.available}
                  onChange={(event) => setEditing({ ...editing, available: event.target.checked })}
                />
                Currently available
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={editing.clinical}
                  onChange={(event) => setEditing({ ...editing, clinical: event.target.checked })}
                />
                Clinical treatment item
              </label>
            </div>
            <RulesEditor
              label="Eligibility requirements"
              value={editing.rules.eligibility}
              questions={configuration.questions}
              onChange={(eligibility) =>
                setEditing({ ...editing, rules: { ...editing.rules, eligibility } })
              }
            />
            <RulesEditor
              label="Exclusions"
              value={editing.rules.exclusions}
              questions={configuration.questions}
              onChange={(exclusions) =>
                setEditing({ ...editing, rules: { ...editing.rules, exclusions } })
              }
            />
            <label>
              Protocol rationale
              <textarea
                value={editing.rules.rationale}
                rows={3}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    rules: { ...editing.rules, rationale: event.target.value },
                  })
                }
              />
            </label>
            <label>
              Clinical validation note
              <textarea
                rows={2}
                value={editing.rules.validationNote}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    rules: { ...editing.rules, validationNote: event.target.value },
                  })
                }
              />
            </label>
            <label className="checkbox-card">
              <input
                type="checkbox"
                checked={editing.rules.validated}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    rules: { ...editing.rules, validated: event.target.checked },
                  })
                }
              />
              <span>
                <strong>These rules match validated clinic protocols.</strong>
                <small>
                  Owner review does not establish medical validation. Record the applicable protocol
                  and clinical review.
                </small>
              </span>
            </label>
            <label>
              Recommendation priority
              <input
                type="number"
                min={0}
                max={1000}
                value={editing.priority}
                onChange={(event) =>
                  setEditing({ ...editing, priority: Number(event.target.value) })
                }
              />
            </label>
            <div className="modal-actions">
              {!isNew ? (
                <button
                  className="button button-coral"
                  type="button"
                  onClick={() => {
                    onChange({
                      ...configuration,
                      products: configuration.products.filter(
                        (product) => product.id !== editing.id,
                      ),
                    });
                    setEditing(null);
                  }}
                >
                  Remove from draft
                </button>
              ) : null}
              <button className="button button-primary">Keep in draft</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

export function QuestionsEditor({
  configuration,
  onChange,
}: {
  configuration: ClinicConfiguration;
  onChange: (configuration: ClinicConfiguration) => void;
}) {
  const [question, setQuestion] = useState<ClinicQuestion | null>(null);
  const [isNew, setIsNew] = useState(false);
  function open(item?: ClinicQuestion) {
    setIsNew(!item);
    setQuestion(
      item
        ? structuredClone(item)
        : {
            id: crypto.randomUUID(),
            text: '',
            why: '',
            type: 'TEXT',
            options: [],
            required: true,
            safetyRelevant: true,
            activeWhen: [],
            priority: 0,
          },
    );
  }
  return (
    <>
      <div className="catalog-heading">
        <p className="muted small">
          Prioritize the questions your clinic needs to recommend safely.
        </p>
        <button className="button button-small" onClick={() => open()}>
          <Icon name="plus" size={14} />
          Add a question
        </button>
      </div>
      {configuration.questions.length ? (
        configuration.questions.map((item) => (
          <div className="catalog-card" key={item.id}>
            <div className="catalog-card-top">
              <div>
                <h3>{item.text}</h3>
                <p>{item.why}</p>
              </div>
              <button className="button button-small button-ghost" onClick={() => open(item)}>
                Edit
              </button>
            </div>
            <div className="catalog-card-bottom">
              <Badge tone={item.required ? 'amber' : 'neutral'}>
                {item.required ? 'Required' : 'Optional'}
              </Badge>
              {item.safetyRelevant ? <Badge tone="teal">Safety relevant</Badge> : null}
              <Badge>{item.type.toLowerCase().replace('_', ' ')}</Badge>
              {item.activeWhen.length ? <Badge>Conditional follow-up</Badge> : null}
            </div>
          </div>
        ))
      ) : (
        <EmptyState
          icon="file"
          title="Help staff ask the right questions."
          action={
            <button className="button button-small" onClick={() => open()}>
              Add a question
            </button>
          }
        >
          Use your clinic&apos;s intake and protocols to identify required safety facts and relevant
          follow-ups.
        </EmptyState>
      )}
      <Modal
        open={Boolean(question)}
        onClose={() => setQuestion(null)}
        title={isNew ? 'Add a question' : 'Edit a question'}
      >
        {question ? (
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              onChange({
                ...configuration,
                questions: isNew
                  ? [...configuration.questions, question]
                  : configuration.questions.map((item) =>
                      item.id === question.id ? question : item,
                    ),
              });
              setQuestion(null);
            }}
          >
            <label>
              Question staff should ask
              <textarea
                value={question.text}
                onChange={(event) => setQuestion({ ...question, text: event.target.value })}
                required
                rows={2}
              />
            </label>
            <label>
              Why it matters
              <textarea
                value={question.why}
                onChange={(event) => setQuestion({ ...question, why: event.target.value })}
                required
                rows={2}
              />
            </label>
            <div className="form-grid">
              <label>
                Answer type
                <select
                  value={question.type}
                  onChange={(event) =>
                    setQuestion({ ...question, type: event.target.value as ClinicQuestion['type'] })
                  }
                >
                  {['TEXT', 'BOOLEAN', 'NUMBER', 'CHOICE', 'MULTI_CHOICE'].map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={question.priority}
                  onChange={(event) =>
                    setQuestion({ ...question, priority: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            {question.type.includes('CHOICE') ? (
              <label>
                Answer choices, one per line
                <textarea
                  value={question.options.join('\n')}
                  onChange={(event) =>
                    setQuestion({ ...question, options: list(event.target.value) })
                  }
                  rows={3}
                  required
                />
              </label>
            ) : null}
            <label className="inline-check">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(event) => setQuestion({ ...question, required: event.target.checked })}
              />
              Required before clinical approval
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={question.safetyRelevant}
                onChange={(event) =>
                  setQuestion({ ...question, safetyRelevant: event.target.checked })
                }
              />
              Relevant to clinical safety
            </label>
            <RulesEditor
              label="Ask this follow-up when"
              value={question.activeWhen}
              questions={configuration.questions.filter((item) => item.id !== question.id)}
              onChange={(activeWhen) => setQuestion({ ...question, activeWhen })}
            />
            <div className="modal-actions">
              {!isNew ? (
                <button
                  className="button button-coral"
                  type="button"
                  onClick={() => {
                    onChange({
                      ...configuration,
                      questions: configuration.questions.filter((item) => item.id !== question.id),
                    });
                    setQuestion(null);
                  }}
                >
                  Remove from draft
                </button>
              ) : null}
              <button className="button button-primary">Keep in draft</button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}

export function SyntheticIntake({
  configuration,
  summary,
  onChange,
}: {
  configuration: ClinicConfiguration;
  summary: ConsultationSummary;
  onChange: (summary: ConsultationSummary) => void;
}) {
  return (
    <div className="form-stack">
      <div className="notice notice-subtle">
        Use invented client details. Setup tests do not consume trial consultations or enter clinic
        reporting.
      </div>
      <div className="form-grid">
        <label>
          Test goals, one per line
          <textarea
            value={summary.goals.join('\n')}
            onChange={(event) => onChange({ ...summary, goals: list(event.target.value) })}
            rows={2}
          />
        </label>
        <label>
          Test preferences, one per line
          <textarea
            value={summary.preferences.join('\n')}
            onChange={(event) => onChange({ ...summary, preferences: list(event.target.value) })}
            rows={2}
          />
        </label>
      </div>
      {configuration.questions.map((question) => (
        <label key={question.id}>
          {question.text}
          {question.type === 'BOOLEAN' ? (
            <select
              value={
                summary.answers[question.id]?.value == null
                  ? ''
                  : String(summary.answers[question.id]?.value)
              }
              onChange={(event) =>
                onChange({
                  ...summary,
                  answers: {
                    ...summary.answers,
                    [question.id]: {
                      value: event.target.value === '' ? null : event.target.value === 'true',
                      status: 'CONFIRMED',
                      source: 'STAFF',
                      evidence: 'Synthetic test',
                    },
                  },
                })
              }
            >
              <option value="">Not answered</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : question.type === 'CHOICE' ? (
            <select
              value={String(summary.answers[question.id]?.value || '')}
              onChange={(event) =>
                onChange({
                  ...summary,
                  answers: {
                    ...summary.answers,
                    [question.id]: {
                      value: event.target.value || null,
                      status: 'CONFIRMED',
                      source: 'STAFF',
                      evidence: 'Synthetic test',
                    },
                  },
                })
              }
            >
              <option value="">Not answered</option>
              {question.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <input
              type={question.type === 'NUMBER' ? 'number' : 'text'}
              value={
                Array.isArray(summary.answers[question.id]?.value)
                  ? (summary.answers[question.id]!.value as string[]).join(', ')
                  : String(summary.answers[question.id]?.value ?? '')
              }
              onChange={(event) =>
                onChange({
                  ...summary,
                  answers: {
                    ...summary.answers,
                    [question.id]: {
                      value:
                        event.target.value === ''
                          ? null
                          : question.type === 'NUMBER'
                            ? Number(event.target.value)
                            : question.type === 'MULTI_CHOICE'
                              ? event.target.value
                                  .split(',')
                                  .map((value) => value.trim())
                                  .filter(Boolean)
                              : event.target.value,
                      status: 'CONFIRMED',
                      source: 'STAFF',
                      evidence: 'Synthetic test',
                    },
                  },
                })
              }
              placeholder={
                question.type === 'MULTI_CHOICE' ? 'Comma-separated choices' : 'Test answer'
              }
            />
          )}
        </label>
      ))}
      <label className="inline-check">
        <input
          type="checkbox"
          checked={summary.staffReviewed}
          onChange={(event) => onChange({ ...summary, staffReviewed: event.target.checked })}
        />
        Treat these synthetic facts as staff reviewed
      </label>
      <label>
        Relevant wellness offers allowed
        <select
          value={summary.wellnessOffersAllowed == null ? '' : String(summary.wellnessOffersAllowed)}
          onChange={(event) =>
            onChange({
              ...summary,
              wellnessOffersAllowed:
                event.target.value === '' ? null : event.target.value === 'true',
            })
          }
        >
          <option value="">Unknown</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
    </div>
  );
}
