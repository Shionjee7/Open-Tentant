/// <reference path="../pb_data/types.d.ts" />

/**
 * Recoverable removal and statement-to-ledger links.
 *
 * Property and tenant records carry lease, signature, and payment history, so
 * the app archives them instead of destroying that history. Bank imports stay
 * linked to expenses so account balances do not count the same withdrawal
 * twice, and handled rows can be hidden without losing duplicate protection.
 */
migrate(
  (app) => {
    const properties = app.findCollectionByNameOrId("properties");
    properties.fields.add(new Field({ name: "archived", type: "bool", required: false }));
    app.save(properties);

    const people = app.findCollectionByNameOrId("people");
    people.fields.add(new Field({ name: "archived", type: "bool", required: false }));
    app.save(people);

    const imports = app.findCollectionByNameOrId("bank_imports");
    imports.fields.add(new Field({ name: "hidden", type: "bool", required: false }));
    app.save(imports);

    const transactions = app.findCollectionByNameOrId("transactions");
    transactions.fields.add(
      new Field({
        name: "bank_import",
        type: "relation",
        required: false,
        collectionId: imports.id,
        cascadeDelete: false,
        maxSelect: 1,
      })
    );
    app.save(transactions);
  },
  (app) => {
    for (const [collectionName, fieldName] of [
      ["transactions", "bank_import"],
      ["bank_imports", "hidden"],
      ["people", "archived"],
      ["properties", "archived"],
    ]) {
      const collection = app.findCollectionByNameOrId(collectionName);
      const field = collection.fields.getByName(fieldName);
      if (field) collection.fields.removeById(field.id);
      app.save(collection);
    }
  }
);
