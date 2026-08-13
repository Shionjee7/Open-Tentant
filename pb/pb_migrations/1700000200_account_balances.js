/// <reference path="../pb_data/types.d.ts" />

/**
 * Opening balances on bank accounts.
 *
 * Imported statements only show what you've uploaded, so they can't tell you
 * what's actually in the account. Tell the app the balance on a given date and
 * it carries that forward with every deposit imported and expense recorded
 * since — which is a number a landlord can check against their bank.
 */
migrate(
  (app) => {
    const accounts = app.findCollectionByNameOrId("bank_accounts");
    accounts.fields.add(
      new Field({ name: "opening_balance", type: "number", required: false })
    );
    accounts.fields.add(
      new Field({ name: "balance_date", type: "text", required: false })
    );
    app.save(accounts);
  },
  (app) => {
    const accounts = app.findCollectionByNameOrId("bank_accounts");
    for (const name of ["opening_balance", "balance_date"]) {
      const field = accounts.fields.getByName(name);
      if (field) accounts.fields.removeById(field.id);
    }
    app.save(accounts);
  }
);
