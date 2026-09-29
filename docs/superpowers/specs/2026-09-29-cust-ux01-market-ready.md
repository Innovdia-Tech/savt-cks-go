# CKS Go UX01 Market-Ready Customer Frontend

**Date:** 2026-09-29  
**Base:** `265a3b80d71138accaab9048a98782ec22377aec`  
**Branch:** `codex/cust-ux01-market-ready`

## Goal

Consolidate the previously accepted CKS Go customer UI, the developer-preview Home merchandising work, and UX01 first-use/address improvements into one production-ready customer experience.

## Non-negotiable behavior

- CKS Retail red remains the primary commerce/action color.
- The real production catalogue/cart/checkout/payment/orders stack remains authoritative.
- Development fixtures never replace real production data.
- The Savt native header owns embedded WebView Back/Close; the web app must not duplicate that chrome when embedded.
- Standalone browser mode keeps its own safe web chrome.
- A brand-new customer must not land on an unusable catalogue.
- A customer must never be asked to type latitude/longitude.
- Existing addresses missing coordinates are repaired, not recreated.
- Location permission is requested only after explicit user action.
- GPS denial must not permanently block address setup.
- No fake map, fake coordinates, or unapproved third-party mapping service may ship.

## Production Home parity

Production Home must contain:

1. compact delivery context + cart;
2. product search;
3. real production advertising/banner carousel;
4. category strip with production-safe artwork/icons;
5. Featured for You / product section;
6. existing Home/Categories/Cart/Orders bottom navigation.

Until a dynamic merchandising feed is available, production may use curated, source-controlled CKS Go campaign slides containing no fabricated prices, savings, stock claims or customer-specific claims.

## Embedded chrome

When `window.SavtCksGoBridge` exists:
- remove duplicate web `CKS Go` title;
- remove duplicate web close control;
- do not duplicate native Back;
- retain route context/title where needed as content, not app chrome;
- retain cart as a customer-web control.

When not embedded, preserve web Back/Close so direct-browser access remains operable.

## Address readiness

A usable delivery address is ACTIVE and has finite latitude and longitude.

On authenticated customer-data load:
- usable selected address -> Home/assignment;
- no active address -> first-use delivery setup;
- active selected address without coordinates -> repair-location flow.

Customer-facing copy uses “delivery location”, never “coordinates”.

## Location provider boundary

The UX owns:
- current-location action;
- address search action;
- detected address;
- confirmation;
- delivery details;
- permission denied/unavailable states.

The provider supplies:
- latitude;
- longitude;
- display address;
- structured city/state/postcode when available.

The production WebView continues to deny unrestricted browser geolocation. Native location is supplied through the trusted Savt bridge. A standalone browser may use browser geolocation only outside the hardened native WebView.

Interactive map/pin rendering must use an explicitly configured approved map provider. When no provider is configured, the UI must show an honest address/location confirmation surface rather than a fake map.

## Address details

The form should ask only for:
- save-as label (Home / Work / Other or custom);
- unit/floor/lot;
- building/residence;
- landmark/delivery instructions;
- recipient;
- phone.

City/state/postcode are derived where available and remain correctable if the provider result is incomplete.

Latitude/longitude remain hidden.

Savt profile name/phone should prefill delivery-contact fields where available.

## Loading

The native Savt host remains responsible for the pre-authenticated loading overlay. Its UX target is one CKS Go branded state with one message: “Getting your store ready…”, red-led branding, reduced-motion support, and separate retry/error states.

The web session boundary retains a matching fallback for standalone browser mode.

## Acceptance

- Production and developer preview share the same Home composition.
- Production displays at least one curated banner without DEV flags.
- Embedded APK shows only one CKS Go app chrome.
- No technical coordinate copy is customer-visible.
- No latitude/longitude text inputs remain in normal customer address setup.
- Existing backend-authoritative shopping/payment/order behavior is unchanged.
- 320/390/430 widths and 200% text remain usable.
- No horizontal overflow; touch targets >=44px.
- Native APK and standalone browser modes both remain navigable.
