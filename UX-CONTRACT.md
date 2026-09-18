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
