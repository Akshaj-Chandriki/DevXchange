# Security Specification

## 1. Data Invariants
- A ticket can only be created by an authenticated user whose email is verified.
- The `userId` of the ticket must match the authenticated user's `uid`.
- The `email` of the ticket must match the authenticated user's `email`.
- The `status` on creation must be exactly `'open'`.
- `createdAt` and `updatedAt` must be set exactly to the server timestamp `request.time`.
- Only the creator of the ticket (or an administrator) can read their ticket.
- Users can update their ticket features but cannot modify the admin status values directly or skip status transitions once finished.
- Modifying `userId`, `email`, or `createdAt` fields after creation is forbidden (immutable fields).

## 2. The "Dirty Dozen" Malicious Payloads (to be blocked)
1. **Unauthenticated Write**: Creating a ticket without a authenticated context.
2. **Identity Spoofing**: User `A_UID` creates a ticket with `userId` of `B_UID`.
3. **Email Spoofing**: User `A_UID` (with email A) creates a ticket with email `B@gmail.com`.
4. **Unverified Email Creator**: User creates a ticket but their `email_verified` flag is `false`.
5. **Admin Status Override**: User creates an ticket with a preset status of `'completed'`.
6. **Future / Client Timestamp injection**: Inserting a future time instead of `request.time` for `createdAt`.
7. **Orphan / Junk ID Poisoning**: Specifying a `ticketId` that has space strings or character size exceeding 128 characters.
8. **Junk Field Value Poisoning**: Injecting an arbitrary 1MB string or array into the `projectType` field.
9. **Mutable User Ownership change**: Updating an existing ticket's `userId` payload to someone else.
10. **Immutable CreatedAt bypass**: Attempting to alter the original `createdAt` timestamp during an update.
11. **Illegal Keys injection**: Injecting extra hidden keys (e.g. `isAdmin: true` or `bountyRank: "prizebuild"`) inside the ticket metadata.
12. **PII Isolation Leak (Unauthorized read)**: Reader tries to list all user tickets without matching `userId == request.auth.uid`.

## 3. The Test Spec
Tests would run under `firestore.rules.test.ts` representing the security gates protecting our path.
