# Implementation Plan: POS Per-Product Discount System

## 1. Data Model & Settings
- **`src/types.ts`**: Add `posProductDiscountEnabled?: boolean` to the `Store` interface.
- **`src/components/StoreSettingsView.tsx`**: Add a toggle for `posProductDiscountEnabled`. This ensures only the Store Admin can control this feature, as requested.

## 2. Cashier POS Experience
- **New Component: `PosDiscountEntryScreen.tsx`**: 
    - A screen listing items in the current cart.
    - Input fields for per-product discount (percentage or fixed).
    - "Checkout" button to transition to the existing payment summary.
- **`src/components/CashCounterView.tsx`**:
    - Manage state for `showDiscountEntryScreen`.
    - Modify the checkout flow: When "Proceed to Payment" is clicked, if `posProductDiscountEnabled` is true, show `PosDiscountEntryScreen` instead of immediately opening the `PaymentSummaryModal`.

## 3. Data Flow
- Ensure discount data captured in `PosDiscountEntryScreen` is passed into `CashCounterView` state and included in the final sale record.
- Maintain existing thermal receipt logic to display applied discounts.

## 4. Verification
- Validate Store Admin settings control the visibility of the new discount entry flow.
- Ensure the discount entry screen is required *before* payment summary.
- Run type checks and build verify functionality.
