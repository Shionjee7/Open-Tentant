/// <reference path="../pb_data/types.d.ts" />

/**
 * OpenTenant collections.
 *
 * PocketBase applies this on startup, so a fresh install has its whole schema
 * with no manual steps. Relations use "cascade delete: false" so removing a
 * property never silently destroys its payment history.
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
    const num = (name, opts = {}) => ({ name, type: "number", required: false, ...opts });
    const bool = (name) => ({ name, type: "bool", required: false });
    const date = (name) => ({ name, type: "text", required: false }); // ISO yyyy-mm-dd
    const rel = (name, collectionId, opts = {}) => ({
      name,
      type: "relation",
      required: false,
      collectionId,
      cascadeDelete: false,
      maxSelect: 1,
      ...opts,
    });
    const files = (name, maxSelect = 10) => ({
      name,
      type: "file",
      required: false,
      maxSelect,
      maxSize: 15 * 1024 * 1024,
    });

    // Collections don't get timestamps unless we ask for them, and the app
    // sorts by `created` everywhere.
    const timestamps = [
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ];

    function create(name, fields) {
      const collection = new Collection({
        name,
        type: "base",
        // The Next.js server talks to PocketBase as a superuser over localhost;
        // these rules keep everything closed to anonymous callers.
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [...fields, ...timestamps],
      });
      app.save(collection);
      return app.findCollectionByNameOrId(name);
    }

    const properties = create("properties", [
      text("name", { required: true, presentable: true }),
      text("address"),
      text("city"),
      text("state"),
      text("zip"),
      text("type"),
      num("beds"),
      num("baths"),
      num("sqft"),
      num("rent"),
      num("deposit"),
      text("status"),
      bool("listed"),
      bool("priority_listing"),
      text("description"),
      text("amenities"),
      text("rental_type"),
      files("photos", 12),
    ]);

    const units = create("units", [
      rel("property", properties.id, { required: true, cascadeDelete: true }),
      text("name", { required: true, presentable: true }),
      num("rent"),
      num("deposit"),
      text("status"),
      num("size_sqft"),
      bool("private_bath"),
      bool("furnished"),
      bool("listed"),
      text("description"),
      files("photos", 8),
    ]);

    const people = create("people", [
      text("first_name", { required: true, presentable: true }),
      text("last_name", { presentable: true }),
      text("email"),
      text("phone"),
      text("stage"),
      rel("property", properties.id),
      rel("unit", units.id),
      text("notes"),
      text("portal_token"),
    ]);

    const questions = create("custom_questions", [
      text("question", { required: true, presentable: true }),
      text("type"),
      bool("required"),
      bool("archived"),
    ]);

    create("applications", [
      rel("person", people.id, { required: true }),
      rel("property", properties.id),
      rel("unit", units.id),
      text("status"),
      num("monthly_income"),
      text("employer"),
      bool("income_verified"),
      text("screening_status"),
      text("screening_notes"),
      text("screening_link"),
      { name: "answers", type: "json", required: false, maxSize: 200000 },
      date("move_in_date"),
    ]);

    const leases = create("leases", [
      rel("property", properties.id, { required: true }),
      rel("unit", units.id),
      { name: "tenants", type: "relation", required: false, collectionId: people.id, cascadeDelete: false, maxSelect: 10 },
      date("start_date"),
      date("end_date"),
      num("rent"),
      num("deposit"),
      text("status"),
      text("esign_provider"),
      text("esign_url"),
      text("esign_document_id"),
      text("notes"),
      files("documents", 6),
    ]);

    const payments = create("payments", [
      rel("lease", leases.id),
      rel("person", people.id),
      num("amount"),
      text("type"),
      date("due_date"),
      date("paid_date"),
      text("method"),
      text("status"),
      text("notes"),
      text("reported_method"),
      date("reported_date"),
      text("reported_note"),
    ]);

    create("maintenance_requests", [
      rel("property", properties.id, { required: true }),
      rel("unit", units.id),
      rel("person", people.id),
      text("title", { required: true, presentable: true }),
      text("description"),
      text("priority"),
      text("status"),
      date("completed_at"),
      files("photos", 8),
    ]);

    create("transactions", [
      rel("property", properties.id),
      date("date"),
      text("type"),
      text("category"),
      num("amount"),
      text("description"),
      rel("payment", payments.id),
    ]);

    create("documents", [
      text("name", { required: true, presentable: true }),
      text("type"),
      rel("lease", leases.id),
      rel("property", properties.id),
      text("status"),
      text("provider"),
      text("external_url"),
      date("signed_at"),
      files("file", 3),
    ]);

    create("condition_reports", [
      rel("property", properties.id, { required: true }),
      rel("lease", leases.id),
      text("type"),
      text("status"),
      { name: "items", type: "json", required: false, maxSize: 200000 },
      text("notes"),
      date("completed_at"),
      files("photos", 20),
    ]);

    const accounts = create("bank_accounts", [
      text("name", { required: true, presentable: true }),
      text("institution"),
      text("last4"),
      text("kind"),
      rel("property", properties.id),
      text("notes"),
    ]);

    create("bank_imports", [
      rel("account", accounts.id),
      date("posted_date"),
      text("description"),
      num("amount"),
      text("source"),
      text("status"),
      rel("payment", payments.id),
      rel("person", people.id),
      text("fingerprint"),
    ]);

    create("settings", [
      text("key", { required: true, presentable: true }),
      text("value"),
    ]);
  },
  (app) => {
    // Rollback: drop in reverse dependency order.
    const names = [
      "settings", "bank_imports", "bank_accounts", "condition_reports", "documents",
      "transactions", "maintenance_requests", "payments", "leases", "applications",
      "custom_questions", "people", "units", "properties",
    ];
    for (const name of names) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch {
        // already gone
      }
    }
  }
);
