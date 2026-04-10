import React, { useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { useB2BMail } from '../hooks/useB2BMail';
import '../CSS/AdminPageLayout.css';
import '../CSS/B2BMailPage.css';
import '../CSS/B2BMailUIScale.css';

const B2BMail = () => {
  const {
    folder,
    setFolder,
    query,
    setQuery,
    loading,
    saving,
    message,
    mailList,
    selectedId,
    setSelectedId,
    selectedDetail,
    detailLoading,
    contacts,
    templates,
    feeders,
    compose,
    setCompose,
    saveDraft,
    previewRecipients,
    sendNow,
    retryFailed,
    upsertContact,
    setContactActive,
    sendContactVerification,
    addTemplate,
    startNewCompose,
    previewResult,
    inboundList,
    inboundLoading,
    activeContactCount,
    refreshInbound,
  } = useB2BMail();
  const [showContacts, setShowContacts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState({
    id: null, companyName: '', contactName: '', email: '', phone: '', feederId: '', feederIds: []
  });
  const feederOptions = useMemo(
    () => (feeders || []).flatMap((a) => (a.feeders || []).map((f) => ({ id: Number(f.id), label: f.label || `${a.label} ${f.code}` }))),
    [feeders]
  );

  const statusChip = (item) =>
    item.status === 'draft'
      ? 'b2b-mail-chip b2b-mail-chip--draft'
      : Number(item.failed_count) > 0
      ? 'b2b-mail-chip b2b-mail-chip--failed'
      : 'b2b-mail-chip b2b-mail-chip--sent';

  return (
    <AdminLayout activePage="b2b-mail">
      <div className="admin-page-container b2b-mail-page-container">
        <header className="dashboard-header-flex">
          <div className="header-content">
            <h2 className="header-title">B2B Mail</h2>
            <p className="header-subtitle">
              Gmail-style feeder communications for LGU/DILG and partner heads.
            </p>
          </div>
          <div className="b2b-mail-header-actions">
            <button type="button" className="b2b-mail-btn b2b-mail-btn--ghost" onClick={() => setMobileDrawerOpen((o) => !o)}>
              Filters
            </button>
            <button type="button" className="b2b-mail-btn b2b-mail-btn--primary" onClick={startNewCompose}>
              Compose
            </button>
          </div>
        </header>

        {message && (
          <p className={`widget-text b2b-mail-msg ${message.type === 'err' ? 'b2b-mail-msg--err' : 'b2b-mail-msg--ok'}`}>
            {message.text}
          </p>
        )}

        <div className="main-content-card b2b-mail-shell">
          <aside className={`b2b-mail-left-nav ${mobileDrawerOpen ? 'is-open' : ''}`}>
            <button type="button" className={`b2b-mail-folder-btn ${folder === 'all' ? 'is-active' : ''}`} onClick={() => setFolder('all')}>All</button>
            <button type="button" className={`b2b-mail-folder-btn ${folder === 'draft' ? 'is-active' : ''}`} onClick={() => setFolder('draft')}>Drafts</button>
            <button type="button" className={`b2b-mail-folder-btn ${folder === 'sent' ? 'is-active' : ''}`} onClick={() => setFolder('sent')}>Sent</button>
            <button type="button" className={`b2b-mail-folder-btn ${folder === 'failed' ? 'is-active' : ''}`} onClick={() => setFolder('failed')}>Failed</button>
            <button type="button" className={`b2b-mail-folder-btn ${folder === 'queued' ? 'is-active' : ''}`} onClick={() => setFolder('queued')}>Queued</button>
          </aside>

          <section className="b2b-mail-list-pane">
            <div className="b2b-mail-list-toolbar">
              <input
                className="b2b-mail-input b2b-mail-input--search"
                placeholder="Search subject, body, sender"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="b2b-mail-list-scroll">
              {loading ? (
                <p className="b2b-mail-empty">Loading messages...</p>
              ) : mailList.length === 0 ? (
                <p className="b2b-mail-empty">No emails found.</p>
              ) : (
                mailList.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`b2b-mail-list-item ${selectedId === m.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <div className="b2b-mail-list-item-head">
                      <strong>{m.subject || '(No subject)'}</strong>
                      <span className={statusChip(m)}>{m.status}</span>
                    </div>
                    <div className="b2b-mail-list-item-meta">
                      <span>Recipients: {m.recipients_count || 0}</span>
                      <span>Sent: {m.sent_count || 0}</span>
                      <span>Failed: {m.failed_count || 0}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="b2b-mail-compose-pane">
            <div className="b2b-mail-compose-toolbar">
              <button type="button" className="b2b-mail-btn b2b-mail-btn--ghost" onClick={saveDraft} disabled={saving}>
                Save Draft
              </button>
              <button type="button" className="b2b-mail-btn b2b-mail-btn--ghost" onClick={previewRecipients} disabled={saving}>
                Preview recipients
              </button>
              <button type="button" className="b2b-mail-btn b2b-mail-btn--primary" onClick={sendNow} disabled={saving}>
                {saving ? 'Working...' : 'Send'}
              </button>
              {selectedId && (
                <button type="button" className="b2b-mail-btn b2b-mail-btn--danger" onClick={() => retryFailed(selectedId)} disabled={saving}>
                  Retry Failed
                </button>
              )}
            </div>

            <div className="b2b-mail-compose-scroll">
              <label className="b2b-mail-field">
                Target mode
                <select
                  className="b2b-mail-input"
                  value={compose.targetMode}
                  onChange={(e) => setCompose((p) => ({ ...p, targetMode: e.target.value }))}
                >
                  <option value="all_feeders">All feeders</option>
                  <option value="selected_feeders">Selected feeders</option>
                  <option value="manual_contacts">Manual contacts</option>
                  <option value="interruption_linked">Interruption-linked feeder</option>
                </select>
                {compose.targetMode === 'all_feeders' && (
                  <span className="b2b-mail-hint">Active contacts: {activeContactCount}</span>
                )}
              </label>

              {previewResult != null && (
                <div className="b2b-mail-card b2b-mail-preview-card">
                  <strong>Recipient preview</strong>
                  <p className="b2b-mail-hint">Total: {previewResult.count}</p>
                  <ul className="b2b-mail-preview-list">
                    {(previewResult.sample || []).map((row, idx) => (
                      <li key={`${row.email}-${idx}`}>{row.name ? `${row.name} · ` : ''}{row.email}</li>
                    ))}
                  </ul>
                </div>
              )}

              {compose.targetMode === 'selected_feeders' && (
                <label className="b2b-mail-field">
                  Feeder targets
                  <select
                    className="b2b-mail-input"
                    multiple
                    value={(compose.selectedFeederIds || []).map(String)}
                    onChange={(e) =>
                      setCompose((p) => ({
                        ...p,
                        selectedFeederIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
                      }))
                    }
                  >
                    {feederOptions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {compose.targetMode === 'manual_contacts' && (
                <label className="b2b-mail-field">
                  Contact targets
                  <select
                    className="b2b-mail-input"
                    multiple
                    value={(compose.selectedContactIds || []).map(String)}
                    onChange={(e) =>
                      setCompose((p) => ({
                        ...p,
                        selectedContactIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
                      }))
                    }
                  >
                    {contacts.filter((c) => c.email_verified === 1 || c.email_verified === true).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contact_name} ({c.email})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {compose.targetMode === 'interruption_linked' && (
                <label className="b2b-mail-field">
                  Interruption ID
                  <input
                    className="b2b-mail-input"
                    type="number"
                    value={compose.interruptionId || ''}
                    onChange={(e) => setCompose((p) => ({ ...p, interruptionId: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Enter interruption advisory ID"
                  />
                </label>
              )}

              <label className="b2b-mail-field">
                Template
                <select
                  className="b2b-mail-input"
                  value={compose.templateId || ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    const tpl = templates.find((t) => Number(t.id) === id);
                    setCompose((p) => ({
                      ...p,
                      templateId: id,
                      subject: tpl ? tpl.subject || p.subject : p.subject,
                      bodyText: tpl ? tpl.body_text || p.bodyText : p.bodyText,
                      bodyHtml: tpl ? tpl.body_html || p.bodyHtml : p.bodyHtml,
                    }));
                  }}
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>

              <label className="b2b-mail-field">
                Subject
                <input
                  className="b2b-mail-input"
                  value={compose.subject}
                  onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Email subject"
                />
              </label>

              <label className="b2b-mail-field">
                Body
                <textarea
                  className="b2b-mail-textarea"
                  value={compose.bodyText}
                  onChange={(e) => setCompose((p) => ({ ...p, bodyText: e.target.value }))}
                  placeholder="Type your message..."
                  rows={10}
                />
              </label>

              <div className="b2b-mail-subpanes">
                <button type="button" className="b2b-mail-btn b2b-mail-btn--ghost" onClick={() => setShowContacts((v) => !v)}>
                  {showContacts ? 'Hide Contacts' : 'Manage Contacts'}
                </button>
                <button type="button" className="b2b-mail-btn b2b-mail-btn--ghost" onClick={() => setShowTemplates((v) => !v)}>
                  {showTemplates ? 'Hide Templates' : 'Save as Template'}
                </button>
              </div>

              {showContacts && (
                <div className="b2b-mail-card">
                  <h4>Contact management</h4>
                  <div className="b2b-mail-grid-2">
                    <input className="b2b-mail-input" placeholder="Company" value={contactDraft.companyName} onChange={(e) => setContactDraft((d) => ({ ...d, companyName: e.target.value }))} />
                    <input className="b2b-mail-input" placeholder="Contact name" value={contactDraft.contactName} onChange={(e) => setContactDraft((d) => ({ ...d, contactName: e.target.value }))} />
                    <input className="b2b-mail-input" placeholder="Email" value={contactDraft.email} onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))} />
                    <input className="b2b-mail-input" placeholder="Phone" value={contactDraft.phone} onChange={(e) => setContactDraft((d) => ({ ...d, phone: e.target.value }))} />
                    <select className="b2b-mail-input" value={contactDraft.feederId} onChange={(e) => setContactDraft((d) => ({ ...d, feederId: e.target.value }))}>
                      <option value="">Primary feeder (optional)</option>
                      {feederOptions.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                    <label className="b2b-mail-field b2b-mail-field--full">
                      Additional feeders (multi-select)
                      <select
                        className="b2b-mail-input"
                        multiple
                        size={Math.min(6, Math.max(3, feederOptions.length))}
                        value={(contactDraft.feederIds || []).map(String)}
                        onChange={(e) =>
                          setContactDraft((d) => ({
                            ...d,
                            feederIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)),
                          }))
                        }
                      >
                        {feederOptions.map((f) => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="b2b-mail-contact-actions">
                      <button
                        type="button"
                        className="b2b-mail-btn b2b-mail-btn--primary"
                        onClick={async () => {
                          await upsertContact({
                            id: contactDraft.id,
                            companyName: contactDraft.companyName,
                            contactName: contactDraft.contactName,
                            email: contactDraft.email,
                            phone: contactDraft.phone || null,
                            feederId: contactDraft.feederId ? Number(contactDraft.feederId) : null,
                            feederIds: contactDraft.feederIds || [],
                          });
                          setContactDraft({ id: null, companyName: '', contactName: '', email: '', phone: '', feederId: '', feederIds: [] });
                        }}
                      >
                        {contactDraft.id ? 'Update contact' : 'Save contact'}
                      </button>
                      {contactDraft.id != null && (
                        <button
                          type="button"
                          className="b2b-mail-btn b2b-mail-btn--ghost"
                          onClick={() =>
                            setContactDraft({
                              id: null,
                              companyName: '',
                              contactName: '',
                              email: '',
                              phone: '',
                              feederId: '',
                              feederIds: [],
                            })
                          }
                        >
                          Cancel edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="b2b-mail-table-wrap">
                    {contacts.map((c) => (
                      <div key={c.id} className="b2b-mail-contact-row">
                        <span>{c.contact_name}</span>
                        <span>{c.email}</span>
                        <span>{c.feeder_label || '-'}</span>
                        <span className={`b2b-mail-chip ${(c.email_verified === 1 || c.email_verified === true) ? 'b2b-mail-chip--sent' : 'b2b-mail-chip--failed'}`}>
                          {(c.email_verified === 1 || c.email_verified === true) ? 'Verified' : 'Unverified'}
                        </span>
                        <button
                          type="button"
                          className="b2b-mail-btn b2b-mail-btn--tiny"
                          onClick={() =>
                            setContactDraft({
                              id: c.id,
                              companyName: c.company_name || '',
                              contactName: c.contact_name || '',
                              email: c.email || '',
                              phone: c.phone || '',
                              feederId: c.feeder_id != null ? String(c.feeder_id) : '',
                              feederIds: Array.isArray(c.feeder_ids) ? c.feeder_ids.map(Number) : [],
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="b2b-mail-btn b2b-mail-btn--tiny"
                          onClick={() => sendContactVerification(c.id)}
                          disabled={c.email_verified === 1 || c.email_verified === true}
                        >
                          {(c.email_verified === 1 || c.email_verified === true) ? 'Verified' : 'Send verify'}
                        </button>
                        <button type="button" className="b2b-mail-btn b2b-mail-btn--tiny" onClick={() => setContactActive(c.id, !c.is_active)}>
                          {c.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showTemplates && (
                <div className="b2b-mail-card">
                  <h4>Template management</h4>
                  <button
                    type="button"
                    className="b2b-mail-btn b2b-mail-btn--primary"
                    onClick={() =>
                      addTemplate({
                        name: `Template ${new Date().toLocaleString()}`,
                        subject: compose.subject,
                        bodyText: compose.bodyText,
                        bodyHtml: compose.bodyHtml || null,
                      })
                    }
                  >
                    Save current as template
                  </button>
                </div>
              )}

              <div className="b2b-mail-card">
                <h4>Message detail</h4>
                {detailLoading ? (
                  <p className="b2b-mail-empty">Loading message detail...</p>
                ) : !selectedDetail ? (
                  <p className="b2b-mail-empty">Select a sent/draft item to view recipient status and audit trail.</p>
                ) : (
                  <div className="b2b-mail-detail">
                    <p><strong>Status:</strong> {selectedDetail.message?.status}</p>
                    <p><strong>Subject:</strong> {selectedDetail.message?.subject || '-'}</p>
                    <div className="b2b-mail-recipient-list">
                      {(selectedDetail.recipients || []).map((r) => (
                        <div key={r.id} className="b2b-mail-recipient-item">
                          <span>{r.email_snapshot}</span>
                          <span className={`b2b-mail-chip b2b-mail-chip--${r.send_status}`}>{r.send_status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="b2b-mail-audit-list">
                      {(selectedDetail.audits || []).map((a) => (
                        <div key={a.id} className="b2b-mail-audit-item">
                          <strong>{a.action}</strong> - {a.details}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="b2b-mail-card">
                <div className="b2b-mail-inbound-head">
                  <h4>Inbound replies</h4>
                  <button type="button" className="b2b-mail-btn b2b-mail-btn--tiny" onClick={refreshInbound} disabled={inboundLoading}>
                    Refresh
                  </button>
                </div>
                {inboundLoading ? (
                  <p className="b2b-mail-empty">Loading replies…</p>
                ) : inboundList.length === 0 ? (
                  <p className="b2b-mail-empty">
                    {selectedId ? 'No replies linked to this message yet.' : 'No stored replies. Enable IMAP poll or use the inbound webhook (see docs).'}
                  </p>
                ) : (
                  <div className="b2b-mail-inbound-list">
                    {inboundList.map((row) => (
                      <div key={row.id} className="b2b-mail-inbound-item">
                        <div className="b2b-mail-inbound-meta">
                          <strong>{row.from_email}</strong>
                          <span className="b2b-mail-hint">{row.received_at}</span>
                        </div>
                        <div className="b2b-mail-inbound-subject">{row.subject || '(no subject)'}</div>
                        {row.body_text && (
                          <pre className="b2b-mail-inbound-body">{String(row.body_text).slice(0, 500)}{String(row.body_text).length > 500 ? '…' : ''}</pre>
                        )}
                        {row.linked_message_id != null && (
                          <span className="b2b-mail-hint">Linked outbound id: {row.linked_message_id}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};

export default B2BMail;
