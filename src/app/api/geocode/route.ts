import { NextResponse } from "next/server";

/**
 * Address lookup proxied through the server.
 *
 * Uses OpenStreetMap's Nominatim: free, open source, no API key, no account.
 * Proxying lets us send the User-Agent their usage policy asks for, and keeps
 * the browser from hitting a third party directly.
 *
 * Set GEOCODER_URL to point at your own Nominatim/Photon instance if you'd
 * rather not depend on the public one.
 */

const GEOCODER = process.env.GEOCODER_URL?.trim() || "https://nominatim.openstreetmap.org/search";
const CONTACT = process.env.GEOCODER_CONTACT?.trim() || "self-hosted OpenTenant";

export type AddressSuggestion = {
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

function abbreviate(state: string): string {
  if (!state) return "";
  if (state.length === 2) return state.toUpperCase();
  return US_STATES[state.toLowerCase()] ?? state;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return NextResponse.json({ results: [] });

  const url = new URL(GEOCODER);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": `OpenTenant/0.1 (${CONTACT})`, "Accept-Language": "en" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return NextResponse.json({ results: [] });

    const raw = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    }[];

    const results: AddressSuggestion[] = raw.map((item) => {
      const a = item.address ?? {};
      const street = [a.house_number, a.road].filter(Boolean).join(" ");
      const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || "";
      return {
        label: item.display_name ?? street,
        address: street,
        city,
        state: abbreviate(a.state ?? ""),
        zip: a.postcode ?? "",
      };
    });

    // Keep only entries that actually name a street — a county or state alone
    // isn't useful for a property record.
    return NextResponse.json({ results: results.filter((r) => r.address) });
  } catch {
    // Offline or the geocoder is down: autocomplete quietly does nothing and
    // the landlord types the address by hand.
    return NextResponse.json({ results: [] });
  }
}
