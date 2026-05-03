# ConfirmDialog Component

**Source file:** `src/components/ui/confirm-dialog.tsx`  
**Used in:** `src/components/map/planner-overlay.tsx` (leg deletion)

---

## Overview

`ConfirmDialog` is a reusable modal confirmation dialog intended for any destructive or irreversible action. It renders a full-screen backdrop that blocks pointer events (preventing accidental map interaction), a centred panel with a contextual icon, a title, a message, and Cancel / Confirm buttons.

---

## Design Rationale

**Why a modal rather than an inline prompt?**  
Destructive actions — deleting a leg, clearing a route — need to be a deliberate, two-step gesture. An inline "are you sure?" link is too easy to miss or accidentally dismiss. A modal forces the user to consciously choose before data is lost.

**Why auto-focus Cancel?**  
The default focus is on the Cancel button, not Confirm. This is the safer default: a user who presses Enter or Space immediately after triggering the action will dismiss rather than destroy.

**Why `pointer-events-auto` on the backdrop?**  
The planner panel sits inside a fixed overlay above the Mapbox canvas. Without `pointer-events-auto` on the dialog backdrop, click events fall through to the map underneath and the user can accidentally move the map while the dialog is open.

**Why Escape closes the dialog?**  
Standard keyboard UX: Escape = cancel. The handler is scoped to `open === true` so it doesn't affect the rest of the UI when no dialog is shown.

---

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | — | Controls visibility. When `false` nothing is rendered (no portal, no backdrop). |
| `title` | `string` | — | Bold heading shown in the panel. Keep it short (≤ 40 chars). |
| `message` | `string` | — | Secondary explanatory text. Describe exactly what will be lost. |
| `confirmLabel` | `string` | `'Confirm'` | Text for the action button. |
| `cancelLabel` | `string` | `'Cancel'` | Text for the dismiss button. |
| `variant` | `'danger' \| 'primary'` | `'danger'` | `danger` = red accent + trash icon. `primary` = brand accent + info icon. |
| `onConfirm` | `() => void` | — | Called when the user clicks the confirm button. |
| `onCancel` | `() => void` | — | Called when the user clicks Cancel, the scrim, or presses Escape. |

---

## Usage Pattern

```tsx
const [pendingItem, setPendingItem] = useState<Item | null>(null);

// Trigger:
<button onClick={() => setPendingItem(item)}>Delete</button>

// Dialog:
<ConfirmDialog
  open={pendingItem !== null}
  title={`Remove ${pendingItem?.name ?? 'item'}?`}
  message="This action cannot be undone."
  confirmLabel="Remove"
  onConfirm={() => {
    if (pendingItem) deleteItem(pendingItem.id);
    setPendingItem(null);
  }}
  onCancel={() => setPendingItem(null)}
/>
```

The pattern stores *what* is pending (the item object) rather than a boolean so the dialog message can reference the item name without an extra state variable.

---

## Accessibility

- `role="dialog"` + `aria-modal="true"` on the root element
- `aria-labelledby="confirm-dialog-title"` links the panel to the `<h2>` title
- Cancel button receives `autoFocus` on open via `useEffect`
- Escape key dismissal via `keydown` listener scoped to `open === true`

---

## Extending

To add a new variant (e.g. `'warning'`):
1. Add the variant to the `variant` union in `ConfirmDialogProps`
2. Add a colour class branch in `confirmCls`
3. Add an icon branch in the icon `div`
