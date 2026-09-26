# Admission harden apps bind

Booking and admission render a mock credential from the protocol adapter. The label is `valid`, `invalid`, `stale`, `already-consumed`, `transferred`, `cancelled`, or `unavailable-server`. The adapter assigns that label. The page prints it. The page does not decide entry.

This harden uses the real loopback transport as a boundary. Stub mode stays the default. HTTP mode still requires an explicit `http://127.0.0.1` base URL. `presentAdmission` in HTTP mode reads `GET /health` only. It does not post `admit`. A reachable gate is `invalid` / `NOT_BOUND`, not a fresh credential. A closed port is `unavailable-server`. Neither result is venue admission.

## What the stub mirrors

The in-process credential uses the protocol phase names `ELIGIBLE`, `AUTHORIZED`, and `CONSUMED`.

Adopt requires an issued reservation. Authorize checks holder, version, listing, transfer, cancellation, and external labels, then delegates to the reservation case. Consume before authorize is `ADMISSION_REQUIRED` and does not change the reservation. A second consume is `ALREADY_CONSUMED`. The same idempotency key replays the first result. A rejected key stays rejected. An expired window is `ADMISSION_EXPIRED` and does not consume. A venue or revocation label is unavailable and is not an allow. `admissionRoutingProduction` stays false. External admission stays `UNSUPPORTED`.

`deskState: "valid"` means the mock presentation still matches those reads. It is not a gate scan.

## Dependency baseline

Protocol main `3b6bdd26f61bb828af3781946b63a3a3fa03187b`.

Feature commit `38a3d68f714100e385ba9e2b7716ed2e5b890d12`.

Machine: `reference/booking_resale_admission/admission_fsm.py`.

Case provenance: `MOCK_GATE_ONLY`.

The desk surface `wave4.admission.P03.fsm` is a charter label. P03 stays **설계중**.

## Transport

The contract-only pin is unchanged. The integration-gate file digest moved in the production-readiness bind. See [prod-readiness-apps-bind.md](prod-readiness-apps-bind.md).

| Pin | Value |
| --- | --- |
| Contract-only file sha256 | `fdeb1a49276249816757354cb9812a1a1463037bd1a8fc03aca33ec036c7088e` |
| Integration-gate file sha256 | `2a2af554cb1a8b128f2cf1b1d5b8cf6b1c8fa90adf30865dbc3e64932b3bd13f` |
| Source `protocol_contract.json` sha256 | `ed827de1a8bfe7c48612473965793dcaab65137e575f862761fd160f77ae4c1e` |

`liveHttpServer` on the contract-only file stays false. The gate file stays loopback-only with `productionEndpoint` false. Catalogue commands stay 40. `authorize_admission` and `consume_admission` are not commands. The client rejects those names before a request.

Run the gate from the production-readiness merge in [prod-readiness-apps-bind.md](prod-readiness-apps-bind.md). The admission FSM baseline above is the machine this desk mirrors. It is not the gate process tip:

```bash
python3 -m integration_gate --port 8765
```

The process binds `127.0.0.1` only. Local HTTP success is not production approval.

## Hold

No venue hardware, no offline admission authority, no public endpoint, and no production credential issuance or revocation. The booking desk can show the label and cannot consume. The admission desk consume goes through the credential command, which refuses a direct consume.
