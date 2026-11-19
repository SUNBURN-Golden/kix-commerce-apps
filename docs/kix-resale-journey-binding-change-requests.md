# Resale market change requests

The table below is the supervisor's PR-body section. Both adapter modes return a typed `NOT_BOUND` result for these reads. The controls display the reason in the selected language. The synthetic product catalogue and bid/ask simulator are page-load examples. Their records cannot satisfy these requests.

## NOT_BOUND list

| Screen need | Pinned query, if present | Missing interface or decision | User-visible reason | Decision owner |
| --- | --- | --- | --- | --- |
| Open listings | `list_open_listings` | Loopback list route, actor visibility, ordering, cursor and watermark | No read endpoint at the pinned gate. | KIX Protocol |
| Product search | — | Product identity, filter and paginated result shape | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Listing detail | `get_listing` | Authorized point lookup with listing identity and freshness | No read endpoint at the pinned gate. | KIX Protocol |
| Product detail | — | Product-to-listing association and detail schema | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Variant selector | — | Variant IDs and their relation to rights | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Bid and ask quotes | — | Versioned quote sides, amounts, availability and expiry | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Offers | — | Actor-scoped offer list, matching rules and pagination | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Trade history | — | Visible trade rows, units, timestamps and pagination | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Price series | — | Series definition, units and observation window | No read endpoint at the pinned gate. | KIX Product / Protocol |
| Current holder and right version | `get_right` | Gate route and authority at a specified read watermark | No read endpoint at the pinned gate. | KIX Protocol |
| Presentation after transfer | `get_presentation` | Scoped presentation lookup | No read endpoint at the pinned gate. | KIX Protocol |
| Active settlement | `get_settlement` | Gate route and subject binding. The fixture transfer has a null settlement ID. | No read endpoint at the pinned gate. | KIX Protocol |
| Uncertain operation recovery | — | Authoritative lookup by operation/trace, subject and source cut | No read endpoint at the pinned gate. | KIX Protocol |

The named queries occur in the pinned reference vectors. The pinned integration OpenAPI exposes a local command call and process probes. It publishes no read transport for these needs. Subject visibility, open-list ordering, market matching, pagination policy and economic finality remain undetermined.
