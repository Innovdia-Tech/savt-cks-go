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
| Commerce            | CatalogueApp                                      | Disabled Add; unavailable Cart/Orders; prototype not routed                 | component/browser checks and source review                      |

Keep the existing profile/address forms, mutation outcomes, confirmations and session boundary intact. Browser Back restores screen/product navigation; query/filter/page state is intentionally ephemeral and never persisted. A full refresh performs fresh session/address loading and assignment. Catalogue GETs cannot renew or resolve outlets by themselves; the controller uses a separate bounded assignment POST when needed.
