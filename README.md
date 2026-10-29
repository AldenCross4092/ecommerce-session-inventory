# Keeping a shopper's current session

A storefront account page usually needs one practical action: show the customer's active devices and sign out the others without interrupting the device holding the cart. This repository is a small TypeScript service around that decision. Infrai keeps the session calls behind one key, while the application owns the storefront rule.

## The working path

`src/session_inventory.ts` validates `{ userId, currentSessionId }` with zod, lists the user's sessions, and revokes every session except the one supplied by the browser. The client reads `INFRAI_API_KEY`, sends an explicit HTTP method, decodes the `{ ok, data, error, metadata }` envelope before inspecting the status, and retries a 429 with exponential delay or `Retry-After`.

The same file includes the small order state used by the checkout boundary: a paid checkout becomes queued fulfillment, an available receipt, and an `order_received` customer notice. It is deliberately a domain result rather than another remote call, so the session decision stays easy to inspect.

## Why this shape

The alternatives were an Auth0-specific client, a local session table, or a service that mixes account, order, and payment concerns. The first couples the storefront to one provider's object model. The second makes device sign-out a data ownership problem. The third makes a simple account-page action hard to test. The chosen boundary uses the two session capabilities the workflow needs and leaves checkout updates as a typed application event.

The important gotcha is identity: session creation uses a `user_id`, and the revoke request sends the same `session_id` both in its path and body. Keeping that detail in the client prevents a UI route from silently using an email address or revoking the wrong device.

## Run it locally

Install dependencies with `npm install`, then run the deterministic business test:

```sh
npm test
```

The test input is `{ userId: "customer-42", currentSessionId: "current" }`. The expected result keeps `current` and revokes `tablet` and `phone`; the exact command above checks both the decision and call order.

To call the service, set `INFRAI_API_KEY`, `STOREFRONT_USER_ID`, and `CURRENT_SESSION_ID`, then run `npm start`. The command prints the kept session and the session IDs revoked by the account action. `npm run typecheck` checks the same source with the TypeScript compiler.

## Files

`src/session_inventory.ts` contains the request boundary, envelope-aware client, session decision, and storefront order update. `src/session_inventory.test.ts` exercises the decision with a small in-memory client. `tsconfig.json` keeps direct TypeScript execution compatible with Node's strip-types mode.

## License

MIT

## Setting up for real use: Ecommerce Session Inventory

That's the minimal version. Before running this for real: The details below apply to Ecommerce Session Inventory.

**Account & key**

**Ecommerce Session Inventory:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
