/**
 * ASX container pricing ladder ($0–$99) validated with Zod.
 * Checkout remains off; these are proposed public tiers.
 */
import { z } from "zod";

export const PricingTierSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      priceUsd: z.number().int().min(0).max(99),
      containersPerMonth: z.number().int().positive(),
      scope: z.string().min(1),
      checkout: z.literal("off"),
    })
  )
  .min(1)
  .refine(
    (tiers) => {
      const prices = tiers.map((t) => t.priceUsd);
      return prices[0] === 0 && prices[prices.length - 1] === 99;
    },
    { message: "Ladder must start at $0 and end at $99" }
  );

export const PRICING_TIERS = PricingTierSchema.parse([
  {
    id: "free",
    name: "Free",
    priceUsd: 0,
    containersPerMonth: 1,
    scope: "Municipal, small claims, and traffic records",
    checkout: "off",
  },
  {
    id: "starter",
    name: "Starter",
    priceUsd: 5,
    containersPerMonth: 2,
    scope: "Local ordinance and municipal appeals",
    checkout: "off",
  },
  {
    id: "basic",
    name: "Basic",
    priceUsd: 9,
    containersPerMonth: 5,
    scope: "Magistrate and limited civil records",
    checkout: "off",
  },
  {
    id: "plus",
    name: "Plus",
    priceUsd: 19,
    containersPerMonth: 8,
    scope: "Expanded state trial records and Constructs",
    checkout: "off",
  },
  {
    id: "standard",
    name: "Standard",
    priceUsd: 29,
    containersPerMonth: 12,
    scope: "District, second district, and family court records",
    checkout: "off",
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 49,
    containersPerMonth: 20,
    scope: "Multi-district state packs and verification runs",
    checkout: "off",
  },
  {
    id: "advanced",
    name: "Advanced",
    priceUsd: 69,
    containersPerMonth: 30,
    scope: "State appellate packs and cross-district Constructs",
    checkout: "off",
  },
  {
    id: "premium",
    name: "Premium",
    priceUsd: 99,
    containersPerMonth: 40,
    scope:
      "Federal district, appellate, and civil-rights records, including §1983 and Monell labels",
    checkout: "off",
  },
]);

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        count: PRICING_TIERS.length,
        prices: PRICING_TIERS.map((t) => t.priceUsd),
      },
      null,
      2
    )
  );
}
