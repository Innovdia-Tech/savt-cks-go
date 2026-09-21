# Customer UI contract

## Canonical UI Map

| Capability     | Canonical owner                                | Source of truth           | Allowed variants                                             | Verification                           |
| -------------- | ---------------------------------------------- | ------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Form           | src/addresses/AddressForm.tsx                  | Customer DTOs             | Add/edit, memory-only drafts                                 | Validation and browser create/edit     |
| Select/Listbox | CheckoutAddress in src/customer/components.tsx | Active saved-address list | Native platform popup                                        | Checkout selection and keyboard        |
| CRUD           | src/customer/state.ts                          | Customer address service  | Pessimistic writes, explicit conflict reload, stable retries | API/state tests and browser full flow  |
| Toast          | DataFeedback in src/customer/components.tsx    | Customer error contracts  | Persistent inline status/error                               | Render and browser failure tests       |
| Navigation     | src/customer/context.tsx                       | Memory-only form state    | Discard dialog; native beforeunload                          | Escape, cancel, discard browser checks |
| Scrollbar      | Existing src/styles.css and Layout.tsx         | Existing prototype shell  | Existing scroll ownership preserved                          | Narrow and desktop browser review      |

Source authority: current CKS Go customer DTOs, controller, address service and session guards. Tests: customer/contracts, API, state and rendered presentation suites; local browser acceptance at the requested narrow sizes. No sensitive values in URLs, storage, logs or presentation session snapshots. Legacy mocked affordances and scrollbar design are explicitly outside this bounded package.

## CUST02B catalogue UI consequences

Source: frozen CUST02A-CP0-R2, assignment lifecycle, strict envelopes and CUST02B package sections. Catalogue does not redefine backend policy.

| Capability          | Canonical owner                                   | Allowed variant                                                             | Verification                                                    |
| ------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Address selection   | Existing CheckoutAddress / CustomerDataController | Catalogue copy; no mutation or session authority change                     | catalogue/address-selection tests and browser address switch    |
| Browse state        | catalogue/state.ts                                | Automatic address-driven assignment; bounded renewal; late response fencing | state tests including expiry during pending reads               |
| Search / pagination | catalogue/components.tsx and API                  | Server query, explicit Previous/Next, page reset; memory-only filters       | HTTP tests and browser search/page/empty results                |
| Status              | CatalogueStatus                                   | Inline loading, empty, error, expiry and read-only copy                     | rendered tests and deterministic browser scenarios              |
| Images              | ProductImage                                      | Fixed placeholder, lazy returned image, load-error fallback                 | component test and browser null-image geometry                  |
| Navigation          | Existing guardNavigation + screen/product hash    | Existing unsaved-form guard; no context/address in URL                      | keyboard search, detail/back/refresh, profile and logout checks |
| Commerce            | CatalogueApp                                      | Historical CUST02B boundary; superseded by the CUST02C map below            | component/browser checks and source review                      |

Keep the existing profile/address forms, mutation outcomes, confirmations and session boundary intact. Browser Back restores screen/product navigation; query/filter/page state is intentionally ephemeral and never persisted. A full refresh performs fresh session/address loading and assignment. Catalogue GETs cannot renew or resolve outlets by themselves; the controller uses a separate bounded assignment POST when needed.

## CUST02C cart and trusted quote UI consequences

Source: approved CUST02C package, existing trusted checkout quote API and frozen assignment-context contract. These rows describe UI behavior; backend policy remains authoritative.

| Capability          | Canonical owner                                  | Allowed variant                                                                                                           | Verification                                |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Cart identity       | `checkout/state.ts`                              | One outlet; exact `outletProductId` merge; bounded line/quantity; memory-only display snapshots                           | state and rendered cart tests               |
| Address transition  | `checkout/context.tsx` and `AddressChangeDialog` | Same outlet preserves cart; different nonempty cart requires app-owned clear confirmation                                 | transition tests and browser cancel/confirm |
| Quote action        | `CartScreen` and `checkout/api.ts`               | Explicit customer action only; stable UUIDv4 per attempt; no client-calculated commercial fields                          | API/state tests and request inspection      |
| Quote evidence      | `QuoteSummary`                                   | Closed authoritative lines, totals, currency, timing, expiry and returned assignment evidence                             | parser/render tests and browser success     |
| Price review        | `checkout/state.ts`                              | Changed server prices block reviewed state until explicit acceptance                                                      | state/render tests and browser scenario     |
| Expiry/recovery     | `checkout/state.ts` and `QuoteSummary`           | Expired quote is not actionable; explicit requote; bounded same-attempt retry only for uncertain transport/parse failures | timer, API and browser failure scenarios    |
| Downstream boundary | `CatalogueApp`                                   | No payment, order creation, mock confirmation, receipt or tracking action from the real cart                              | component tests and source/browser review   |

The assignment-context handle and all credentials remain memory-only and never enter URLs, storage, logs or visible error copy. Browser Back may restore catalogue navigation only; refresh reconstructs an empty cart and requests a fresh assignment context. The native address select remains platform-owned. The clear-cart confirmation is app-owned, Escape-cancelable, viewport-bounded and initially focuses Cancel.
