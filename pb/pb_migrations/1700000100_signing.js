/// <reference path="../pb_data/types.d.ts" />

/**
 * Built-in e-signatures.
 *
 * One row per signer per lease. The token is the signing link; the rest is the
 * audit trail the ESIGN Act and UETA care about — who signed, that they
 * consented to sign electronically, when, from where, and a hash of the exact
 * document they saw, so a later edit to the lease is detectable.
 */
migrate(
  (app) => {
    const text = (name, opts = {}) => ({
      name,
      type: "text",
      required: false,
      presentable: false,
      ...opts,
    });

    const leases = app.findCollectionByNameOrId("leases");
    const people = app.findCollectionByNameOrId("people");

    const collection = new Collection({
      name: "signatures",
      type: "base",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: "lease",
          type: "relation",
          required: true,
          collectionId: leases.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // Blank for the landlord, who isn't a person record.
        {
          name: "person",
          type: "relation",
          required: false,
          collectionId: people.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        text("role"), // landlord | tenant
        text("signer_name", { presentable: true }),
        text("signer_email"),
        text("token"), // the unguessable signing link
        text("status"), // pending | signed | declined | cancelled
        text("typed_name"),
        // A PNG data URL from the draw-your-signature pad. Optional — a typed
        // name is a signature under ESIGN; the drawing is for people who
        // expect one to look like a signature.
        text("drawn_signature", { max: 400000 }),
        text("consent_text"),
        text("document_hash"),
        text("ip"),
        text("user_agent"),
        text("sent_at"),
        text("signed_at"),
        text("decline_reason"),
      ].concat([
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ]),
    });

    app.save(collection);

    const index = "CREATE UNIQUE INDEX idx_signatures_token ON signatures (token)";
    const saved = app.findCollectionByNameOrId("signatures");
    saved.indexes = [index];
    app.save(saved);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("signatures"));
    } catch {
      // already gone
    }
  }
);
