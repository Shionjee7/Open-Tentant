/// <reference path="../pb_data/types.d.ts" />

/**
 * Remembering what a vendor is.
 *
 * A statement says the same thing every month. "DUKE ENERGY OH" is the electric
 * bill in January and it is still the electric bill in December. Built-in
 * patterns cover the big names, but every landlord has a plumber, a lawn
 * service and a water district the app has never heard of — and re-sorting the
 * same six rows every month is exactly the chore that sends people back to a
 * spreadsheet.
 *
 * So a rule is: when a statement line contains this text, it is this kind of
 * expense, for this property. Written once, applied to every import after.
 */
migrate(
  (app) => {
    const properties = app.findCollectionByNameOrId("properties");

    const rules = new Collection({
      name: "vendor_rules",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        // The text to look for in a statement line, stored lower-cased.
        { name: "match", type: "text", required: true, presentable: true },
        // What it is: an expense category, or "rent" for money coming in.
        { name: "category", type: "text", required: true },
        // Which house it belongs to. Blank means "ask me".
        {
          name: "property",
          type: "relation",
          required: false,
          collectionId: properties.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        // How money moves: "expense" or "income".
        { name: "direction", type: "text", required: false },
        // How many statement lines this rule has sorted, so a rule that never
        // fires is visible as one worth deleting.
        { name: "uses", type: "number", required: false },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    });
    app.save(rules);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("vendor_rules"));
    } catch {
      // already gone
    }
  }
);
