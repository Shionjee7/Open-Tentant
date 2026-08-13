import { expect, test, type Page } from "@playwright/test";

const today = new Date();
const month = today.toISOString().slice(0, 7);
const dueDate = `${month}-01`;
const leaseStart = `${today.getFullYear()}-01-01`;
const leaseEnd = `${today.getFullYear() + 1}-01-01`;

const houses = [
  {
    name: "Maple House",
    address: "101 Maple Street",
    city: "Norfolk",
    state: "VA",
    zip: "23510",
    rent: 850,
    account: "Maple rent checking",
    institution: "Chase",
    last4: "1111",
    opening: 10000,
    utility: 300,
    mortgage: 2200,
    tenants: ["Alice Carter", "Brian Davis", "Carla Evans", "David Foster", "Elena Garcia"],
  },
  {
    name: "Oak House",
    address: "202 Oak Avenue",
    city: "Norfolk",
    state: "VA",
    zip: "23504",
    rent: 900,
    account: "Oak rent checking",
    institution: "Navy Federal",
    last4: "2222",
    opening: 12000,
    utility: 350,
    mortgage: 2500,
    tenants: ["Farah Hall", "George Irwin", "Hannah Jones", "Isaac King", "Julia Lewis"],
  },
];

async function waitForAutosave(page: Page) {
  await expect(page.getByText("All changes saved").first()).toBeVisible();
}

async function optionValueStartingWith(page: Page, name: string, prefix: string) {
  return page.locator(`select[name="${name}"] option`).evaluateAll((options, expected) => {
    const match = options.find((option) => (option.textContent || "").trim().startsWith(expected));
    if (!match) throw new Error(`No ${name} option starts with ${expected}`);
    return (match as HTMLOptionElement).value;
  }, prefix);
}

test("two five-room houses can be managed from setup through partner reporting", async ({ page }) => {
  const propertyIds: string[] = [];
  const tenantIds = new Map<string, string>();
  const leaseIds = new Map<string, string>();

  await test.step("add two five-room properties with autosave", async () => {
    for (const house of houses) {
      await page.goto("/properties/new");
      await page.getByLabel("Property name").fill(house.name);
      await page.getByLabel(/Street address/).fill(house.address);
      await page.getByLabel("City").fill(house.city);
      await page.getByLabel("State").fill(house.state);
      await page.getByLabel("ZIP").fill(house.zip);
      await page.getByLabel("By the room").check();
      await page.getByLabel("How many rooms?").fill("5");
      await page.getByLabel("Rent per room ($/mo)").fill(String(house.rent));
      await waitForAutosave(page);
      await page.getByRole("button", { name: "Done" }).click();
      await expect(page).toHaveURL(/\/properties\/(?!new(?:[/?]|$))[^/?]+$/);
      propertyIds.push(new URL(page.url()).pathname.split("/").pop()!);
      await page.getByRole("link", { name: /Rooms \(5\)/ }).click();
      await expect(page.getByText("5 rooms")).toBeVisible();
      await expect(page.getByText(`$${(house.rent * 5).toLocaleString()}`)).toBeVisible();

      if (house.name === "Maple House") {
        const roomsSection = page.locator("section").filter({
          has: page.getByRole("heading", { name: "Rooms" }),
        });
        const firstRoom = roomsSection.getByRole("listitem").first();
        await expect(firstRoom.getByRole("button", { name: /save/i })).toHaveCount(0);
        await firstRoom.getByLabel("Deposit ($)").fill("500");
        await expect(firstRoom.getByText("All changes saved")).toBeVisible();
        await page.reload();
        await expect(
          roomsSection.getByRole("listitem").first().getByLabel("Deposit ($)")
        ).toHaveValue("500");
      }
    }
  });

  await test.step("edit a property without a save button", async () => {
    await page.goto(`/properties/${propertyIds[0]}/edit`);
    await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0);
    await page.getByLabel("Property name").fill("Maple House - Partner A");
    await waitForAutosave(page);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: "Maple House - Partner A" })).toBeVisible();
    houses[0].name = "Maple House - Partner A";
  });

  await test.step("add and assign ten tenants with autosave", async () => {
    for (let houseIndex = 0; houseIndex < houses.length; houseIndex++) {
      const house = houses[houseIndex];
      for (let roomIndex = 0; roomIndex < house.tenants.length; roomIndex++) {
        const fullName = house.tenants[roomIndex];
        const [firstName, lastName] = fullName.split(" ");
        await page.goto("/contacts/new?stage=tenant");
        await page.getByLabel("First name").fill(firstName);
        await page.getByLabel("Last name").fill(lastName);
        await page.getByLabel("Email").fill(`${firstName}.${lastName}@example.com`.toLowerCase());
        await page.getByLabel("Phone").fill(`757555${houseIndex}${roomIndex}00`);
        await page.getByLabel("Property").selectOption(propertyIds[houseIndex]);
        const roomId = await optionValueStartingWith(page, "unit_id", `Room ${roomIndex + 1}`);
        await page.getByLabel("Room").selectOption(roomId);
        await waitForAutosave(page);
        const id = page.url().match(/contacts\/([^/]+)\/edit/)?.[1];
        expect(id).toBeTruthy();
        tenantIds.set(fullName, id!);
        await page.getByRole("button", { name: "Done" }).click();
        await expect(page).toHaveURL(/\/contacts\?stage=tenant/);
      }
    }
    await expect(page.getByText("Current tenants (10)")).toBeVisible();
  });

  await test.step("edit a tenant and keep the room assignment", async () => {
    const name = houses[0].tenants[0];
    await page.goto(`/contacts/${tenantIds.get(name)}/edit`);
    await page.getByLabel("Phone").fill("7575550199");
    await waitForAutosave(page);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(name)).toBeVisible();
  });

  await test.step("create one active lease and rent charge for every room", async () => {
    for (let houseIndex = 0; houseIndex < houses.length; houseIndex++) {
      const house = houses[houseIndex];
      for (let roomIndex = 0; roomIndex < house.tenants.length; roomIndex++) {
        const name = house.tenants[roomIndex];
        await page.goto("/leases/new");
        await page.locator('select[name="property_id"]').selectOption(propertyIds[houseIndex]);
        const roomId = await optionValueStartingWith(page, "unit_id", `Room ${roomIndex + 1}`);
        await page.locator('select[name="unit_id"]').selectOption(roomId);
        await page.getByLabel(new RegExp(`^${name}`)).check();
        await page.locator('select[name="status"]').selectOption("active");
        await page.locator('input[name="start_date"]').fill(leaseStart);
        await page.locator('input[name="end_date"]').fill(leaseEnd);
        await page.getByRole("button", { name: "Create lease" }).click();
        await expect(page).toHaveURL(/\/leases\/(?!new(?:[/?]|$))[^/?]+$/);
        const leaseId = new URL(page.url()).pathname.split("/").pop()!;
        leaseIds.set(name, leaseId);

        await page.goto("/payments/new");
        await page.locator('select[name="lease_id"]').selectOption(leaseId);
        await page.locator('select[name="person_id"]').selectOption(tenantIds.get(name)!);
        await page.locator('input[name="amount"]').fill(String(house.rent));
        await page.locator('input[name="due_date"]').fill(dueDate);
        await page.getByRole("button", { name: "Create payment(s)" }).click();
        await expect(page).toHaveURL(/\/payments/);
      }
    }

    await page.goto(`/payments?month=${month}`);
    await expect(page.getByText("$8,750").first()).toBeVisible();
    await expect(page.getByText("0/10")).toBeVisible();
  });

  await test.step("lease signing is ready without requiring OpenSign", async () => {
    const firstTenant = houses[0].tenants[0];
    await page.goto(`/leases/${leaseIds.get(firstTenant)}`);
    await expect(page.getByRole("heading", { name: "Lease document & signing" })).toBeVisible();
    await page.getByRole("button", { name: "Send for signature" }).click();
    await expect(page.getByText("Signing links sent.")).toBeVisible();
    await expect(page.getByText("0 of 2 signed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign now" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open link" })).toBeVisible();

    await page.goto("/signing-app");
    await expect(page.getByRole("heading", { name: "Signing app", exact: true })).toBeVisible();
    await expect(
      page.locator('iframe[title="OpenSign"]').or(
        page.getByRole("heading", { name: "Turn on the signing app" })
      )
    ).toBeVisible();
  });

  await test.step("record one bank account per property", async () => {
    for (let index = 0; index < houses.length; index++) {
      const house = houses[index];
      await page.goto("/banking");
      await page.locator('input[name="name"]').fill(house.account);
      await page.locator('input[name="institution"]').fill(house.institution);
      await page.locator('input[name="last4"]').fill(house.last4);
      await page.locator('select[name="property_id"]').last().selectOption(propertyIds[index]);
      await page.getByRole("button", { name: "Add account" }).click();

      const accountRow = page.getByRole("listitem").filter({ hasText: house.account });
      await accountRow.getByText("Set the starting balance").click();
      await accountRow.locator('input[name="opening_balance"]').fill(String(house.opening));
      await accountRow.locator('input[name="balance_date"]').fill(dueDate);
      await accountRow.getByRole("button", { name: "Save" }).click();
    }
  });

  await test.step("import deposits and bills, then reconcile every row", async () => {
    for (let houseIndex = 0; houseIndex < houses.length; houseIndex++) {
      const house = houses[houseIndex];
      const statement = [
        house.institution,
        `Account ****${house.last4}`,
        "Date,Description,Amount",
        ...house.tenants.map((name, index) => `${month}-${String(index + 2).padStart(2, "0")},ZELLE FROM ${name.toUpperCase()},${house.rent}.00`),
        `${month}-10,UTILITY PAYMENT,-${house.utility}.00`,
        `${month}-11,MORTGAGE PAYMENT,-${house.mortgage}.00`,
      ].join("\n");

      await page.goto("/banking");
      await page.locator('textarea[name="statement_text"]').fill(statement);
      await page.getByRole("button", { name: "Import statement" }).click();
      await expect(page.getByText(new RegExp(`Filed under ${house.account}`))).toBeVisible();

      for (const name of house.tenants) {
        const reviewQueue = page.locator("section").filter({
          has: page.getByRole("heading", { name: "Deposits to review" }),
        });
        const depositRow = reviewQueue
          .getByRole("listitem")
          .filter({ hasText: `ZELLE FROM ${name.toUpperCase()}` });
        await depositRow.getByRole("button", { name: "Mark paid" }).click();
        await expect(depositRow).toHaveCount(0);
      }

      for (const description of ["UTILITY PAYMENT", "MORTGAGE PAYMENT"]) {
        const expenseQueue = page.locator("section").filter({
          has: page.getByRole("heading", { name: /Money that went out/ }),
        });
        const expenseRow = expenseQueue.getByRole("listitem").filter({ hasText: description });
        await expenseRow.getByRole("button", { name: "Book expense" }).click();
        await expect(expenseRow).toHaveCount(0);
      }

      if (houseIndex === 0) {
        await page.locator('textarea[name="statement_text"]').fill(statement);
        await page.getByRole("button", { name: "Import statement" }).click();
        await expect(page.getByText(/Imported 0 transactions/)).toBeVisible();
        await expect(page.getByText(/skipped 7 \(already imported\)/)).toBeVisible();
      }
    }
  });

  await test.step("monthly rent and partner report agree", async () => {
    await page.goto(`/payments?month=${month}`);
    await expect(page.getByText("$8,750").nth(0)).toBeVisible();
    await expect(page.getByText("$8,750").nth(1)).toBeVisible();
    await expect(page.getByText("$0").first()).toBeVisible();
    await expect(page.getByText("10/10")).toBeVisible();

    await page.goto(`/reports/portfolio?month=${month}`);
    await expect(page.getByText("$5,350")).toBeVisible();
    await expect(page.getByText("$3,400")).toBeVisible();
    await expect(page.getByRole("row", { name: /Maple House - Partner A/ })).toContainText("$1,750");
    await expect(page.getByRole("row", { name: /Oak House/ })).toContainText("$1,650");
    await expect(page.getByText("Items to verify").locator("..")).toContainText("0");

    await page.goto("/accounting");
    await expect(page.getByText("$11,750")).toBeVisible();
    await expect(page.getByText("$13,650")).toBeVisible();
  });

  await test.step("repairs can be recorded and completed", async () => {
    await page.goto("/maintenance/new");
    await page.locator('select[name="property_id"]').selectOption(propertyIds[0]);
    await page.locator('select[name="person_id"]').selectOption(tenantIds.get(houses[0].tenants[0])!);
    await page.locator('input[name="title"]').fill("Kitchen faucet leaking");
    await page.locator('textarea[name="description"]').fill("Slow drip under the sink.");
    await page.locator('select[name="priority"]').selectOption("high");
    await page.getByRole("button", { name: "Create request" }).click();
    await expect(page.getByText("Kitchen faucet leaking")).toBeVisible();
    const repairRow = page.locator(".card").filter({ hasText: "Kitchen faucet leaking" });
    await repairRow.getByRole("button", { name: "Start" }).click();
    await repairRow.getByRole("button", { name: "Complete" }).click();
    await expect(repairRow.getByText("Completed", { exact: true })).toBeVisible();
  });

  await test.step("active properties are protected, empty ones can be removed and restored", async () => {
    await page.goto(`/properties/${propertyIds[0]}`);
    await page.getByText("Property options").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove property" }).click();
    await expect(page.getByText(/Move out the current tenants/)).toBeVisible();

    await page.goto("/properties/new");
    await page.getByLabel("Property name").fill("Temporary Property");
    await page.getByLabel(/Street address/).fill("303 Test Lane");
    await waitForAutosave(page);
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByText("Property options").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove property" }).click();
    await expect(page).toHaveURL(/\/properties\?removed=1/);
    await page.getByRole("link", { name: /Removed/ }).click();
    const removedRow = page.getByRole("listitem").filter({ hasText: "Temporary Property" });
    await removedRow.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Property restored")).toBeVisible();
  });

  await test.step("tenant removal is recoverable and preserves history", async () => {
    const name = houses[0].tenants[0];
    await page.goto("/contacts?stage=tenant");
    const row = page.getByRole("listitem").filter({ hasText: name });
    await row.getByText("More").click();
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Remove contact" }).click();
    await expect(page).toHaveURL(/view=removed/);
    const removedRow = page.getByRole("listitem").filter({ hasText: name });
    await removedRow.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Contact restored as a past tenant")).toBeVisible();
    await page.goto("/contacts?stage=tenant");
    await expect(page.getByText("Current tenants (9)")).toBeVisible();
  });

  await test.step("mobile navigation leaves the full page usable", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Properties" })).toBeVisible();
    await page.getByRole("link", { name: "Rent" }).click();
    await expect(page.getByRole("heading", { name: "Rent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });
});
