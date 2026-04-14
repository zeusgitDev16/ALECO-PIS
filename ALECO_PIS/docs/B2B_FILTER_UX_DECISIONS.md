# B2B Filter UX Decisions

## Scope
- Align B2B Contacts and Messages filtering UX with ticket-style interaction patterns.
- Keep ticket modules unchanged and use them as reference only.

## Implemented Decisions
- Desktop now uses a dual-pane shell: fixed filter sidebar on the left, content pool on the right.
- Mobile/tablet (<= 767px) hides the desktop sidebar and exposes a slide-in filter drawer.
- Filter controls are tab-aware:
  - Contacts tab: status + debounced search.
  - Messages tab: status, search, date range, sort, and logs visibility.
- Sidebar collapse state persists using `localStorage` key:
  - `b2b-filter-sidebar-collapsed`.
- Filter drawer behavior:
  - outside click closes
  - `Escape` closes
  - background scroll lock while open
  - keyboard tab loop inside drawer for focus containment

## Layering (z-index)
- B2B filter drawer overlay: `z-index: 900`.
- Existing B2B modals use `.b2b-modal-overlay` around `z-index: 1000`.
- Result: contact/compose/message detail modals remain above drawer.

## State Ownership
- Contacts filters remain connected to `useB2BContacts` (`filter`, `searchQuery`).
- Messages filters are page-level in `B2BMail` for sidebar and drawer parity:
  - `status`, `from`, `to`, `searchQuery`, `sortBy`, `showLogs`.
- Message filtering/sorting is computed in `B2BMail` and passed to `B2BMessagesView`.

## Data-Driven Rules
- Draft-specific controls remain conditional:
  - Draft stat/filter UI appears only when draft records exist in live data.
- No ticket code or ticket filter definitions were modified.

## Files Introduced
- `src/components/b2bmail/B2BDualPaneLayout.jsx`
- `src/components/b2bmail/B2BFilterSidebar.jsx`
- `src/components/b2bmail/B2BFilterDrawer.jsx`
- `src/components/b2bmail/B2BContactsSidebarFilters.jsx`
- `src/components/b2bmail/B2BMessagesSidebarFilters.jsx`
- `src/CSS/B2BFilterLayout.css`

