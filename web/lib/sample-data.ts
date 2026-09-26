// Synthetic demo data so anyone (especially judges) can try the app in one
// click before uploading a real CSV. This is NOT the challenge dataset —
// it is made up, including one order too big for a single tote and one
// departure too small for everything, so splitting and rollover both show.

import type { Flight, OrderItem } from "./types";

// name, weight lb, l x w x h inches
const PRODUCTS: [string, number, number, number, number][] = [
  ["Whole Milk 4L", 9.2, 6, 6, 11],
  ["Bread, Whole Wheat", 1.3, 12, 5, 4],
  ["Eggs, 18 pack", 2.6, 12, 6, 3],
  ["Bananas, bunch", 2.8, 10, 7, 5],
  ["Ground Beef 2 lb", 2.0, 8, 5, 3],
  ["Rice 8 kg bag", 17.6, 18, 12, 5],
  ["Flour 10 kg bag", 22.0, 20, 12, 6],
  ["Canned Soup 12-pack", 12.5, 12, 9, 5],
  ["Diapers, big box", 7.5, 17, 12, 12],
  ["Peanut Butter 2 kg", 4.6, 5, 5, 8],
  ["Apple Juice 2L x4", 18.5, 9, 9, 12],
  ["Frozen Pizza x3", 4.2, 12, 12, 6],
  ["Laundry Detergent", 11.0, 8, 5, 12],
  ["Potatoes 10 lb", 10.0, 14, 9, 6],
  ["Tea Bags, family size", 1.1, 7, 4, 5],
  ["Butter 4-pack", 2.0, 7, 5, 3],
];

export function sampleOrderItems(): OrderItem[] {
  const items: OrderItem[] = [];
  const add = (
    orderId: string,
    householdId: string,
    orderDate: string,
    productIdxs: number[],
  ) => {
    for (const idx of productIdxs) {
      const [productName, weightLb, lengthIn, widthIn, heightIn] =
        PRODUCTS[idx % PRODUCTS.length];
      items.push({
        batchId: orderDate === "2026-06-01" ? "1" : "2",
        orderDate,
        orderId,
        householdId,
        destinationCommunity: "Webequie",
        productName,
        weightLb,
        lengthIn,
        widthIn,
        heightIn,
      });
    }
  };

  add("900001", "H-101", "2026-06-01", [0, 1, 2, 3, 15]);
  add("900002", "H-102", "2026-06-01", [5, 7, 13]);
  add("900003", "H-103", "2026-06-01", [8, 11, 1, 14]);
  add("900004", "H-104", "2026-06-01", [6, 10, 12]); // heavy trio
  add("900005", "H-105", "2026-06-01", [0, 4, 4, 2, 9]);
  add("900006", "H-106", "2026-06-01", [3, 1, 15, 14]); // small order
  // The big family stock-up: too heavy AND too bulky for one tote -> splits.
  add("900007", "H-107", "2026-06-02", [5, 6, 7, 8, 10, 12, 13, 0, 0, 2, 9, 11]);
  add("900008", "H-108", "2026-06-02", [1, 2, 3]);
  add("900009", "H-109", "2026-06-02", [13, 9, 4, 15]);
  add("900010", "H-110", "2026-06-02", [7, 0, 1, 12]);
  return items;
}

export function sampleFlightCapacities(): Flight[] {
  return [
    {
      departureId: "1",
      departureDate: "2026-06-02",
      availableTotes: 4, // deliberately tight so rollover shows
      availablePayloadLb: 160,
      availableVolumeCuFt: 8.3,
      loadedToteIds: [],
    },
    {
      departureId: "2",
      departureDate: "2026-06-03",
      availableTotes: 90,
      availablePayloadLb: 2877,
      availableVolumeCuFt: 187.5,
      loadedToteIds: [],
    },
  ];
}
