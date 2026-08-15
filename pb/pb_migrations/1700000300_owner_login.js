/// <reference path="../pb_data/types.d.ts" />

/**
 * Owner sign-in, for the browser app.
 *
 * The old front end ran on a Node server that held a superuser key and did
 * every read itself. A plain HTML/CSS/JS front end has no server of its own, so
 * the browser talks to PocketBase directly and needs an account of its own —
 * this collection — plus rules saying what a signed-in owner may touch.
 *
 * Rules are deliberately "signed in, or nothing". `owners` is the only auth
 * collection, so `@request.auth.id != ""` means "the landlord". Tenants never
 * get an account; their portal works off an unguessable link instead.
 */
migrate(
  (app) => {
    const owners = new Collection({
      name: "owners",
      type: "auth",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: null,
      updateRule: "id = @request.auth.id",
      deleteRule: null,
      fields: [
        { name: "name", type: "text", required: false, presentable: true },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      passwordAuth: { enabled: true, identityFields: ["email"] },
    });
    app.save(owners);

    // Everything the landlord's browser reads and writes.
    const signedIn = '@request.auth.id != ""';
    const collections = [
      "properties", "units", "people", "custom_questions", "applications",
      "leases", "payments", "maintenance_requests", "transactions", "documents",
      "condition_reports", "bank_accounts", "bank_imports", "settings",
      "signatures",
    ];
    for (const name of collections) {
      const collection = app.findCollectionByNameOrId(name);
      collection.listRule = signedIn;
      collection.viewRule = signedIn;
      collection.createRule = signedIn;
      collection.updateRule = signedIn;
      collection.deleteRule = signedIn;
      app.save(collection);
    }
  },
  (app) => {
    const collections = [
      "properties", "units", "people", "custom_questions", "applications",
      "leases", "payments", "maintenance_requests", "transactions", "documents",
      "condition_reports", "bank_accounts", "bank_imports", "settings",
      "signatures",
    ];
    for (const name of collections) {
      try {
        const collection = app.findCollectionByNameOrId(name);
        collection.listRule = null;
        collection.viewRule = null;
        collection.createRule = null;
        collection.updateRule = null;
        collection.deleteRule = null;
        app.save(collection);
      } catch {
        // collection already gone
      }
    }
    try {
      app.delete(app.findCollectionByNameOrId("owners"));
    } catch {
      // already gone
    }
  }
);
