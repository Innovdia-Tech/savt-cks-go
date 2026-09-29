# UX02 synthetic browser acceptance

These screenshots use the local development adapters and synthetic addresses. No production customer address or device location is shown.

| State                                        | Screenshot                                                   |
| -------------------------------------------- | ------------------------------------------------------------ |
| Delivery picker, 320 px                      | [picker-320.png](picker-320.png)                             |
| Delivery picker, 390 px                      | [picker-390.png](picker-390.png)                             |
| Delivery picker, 430 px                      | [picker-430.png](picker-430.png)                             |
| Delivery picker, 768 px                      | [picker-768.png](picker-768.png)                             |
| Search initial                               | [search-empty-320.png](search-empty-320.png)                 |
| Multiple results and Google Maps attribution | [search-results-390.png](search-results-390.png)             |
| No results                                   | [search-no-results-320.png](search-no-results-320.png)       |
| Selected place confirmation                  | [confirm-390.png](confirm-390.png)                           |
| Synthetic GPS confirmation                   | [gps-confirm-320.png](gps-confirm-320.png)                   |
| Synthetic GPS denied                         | [gps-denied-320.png](gps-denied-320.png)                     |
| Browser GPS unavailable fallback             | [gps-unavailable-390.png](gps-unavailable-390.png)           |
| Prefilled delivery details                   | [details-320.png](details-320.png)                           |
| Existing address before coordinate repair    | [repair-before-320.png](repair-before-320.png)               |
| Home after same-ID repair                    | [repair-after-home-320.png](repair-after-home-320.png)       |
| Home after usable saved-address selection    | [home-saved-selection-320.png](home-saved-selection-320.png) |
| Failed assignment preserves prior selection  | [assignment-failure-320.png](assignment-failure-320.png)     |
| Enlarged text stress at 320 px               | [text-200-320.png](text-200-320.png)                         |

The enlarged-text capture temporarily forced all body text to at least 32 px (twice the 16 px mobile input baseline). The override was removed after capture. At 320, 390, 430, and 768 px, the picker had no document-level horizontal overflow, and visible buttons measured at least 44 px on their smallest dimension. The native device permission path was not exercised in this browser; the synthetic current-location adapter covered granted and denied UI states.
