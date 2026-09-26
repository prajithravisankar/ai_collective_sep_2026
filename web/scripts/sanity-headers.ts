// Header tolerance check: the same data with renamed/messy columns must
// parse identically ("exact column names will be confirmed at the event").
// Run from web/:  npx tsx scripts/sanity-headers.ts

import { parseFlightCapacityCsvText, parseOrdersCsvText } from "../lib/csv";

const canonical = `batch_id,order_date,order_id,household_id,destination_community,product_id,product_name,weight_lb,length_in,width_in,height_in
1,2026-06-01,353094,416,Webequie,5022,Apricot,0.0772,1.772,1.772,1.772`;

const messy = `Batch,Order Date,Order Number,Household,Destination,SKU,Item Name,Weight (lb),Length (in),Width (in),Height (in)
1,2026-06-01,353094,416,Webequie,5022,Apricot,"0.0772",1.772,1.772,1.772`;

const a = parseOrdersCsvText(canonical)[0];
const b = parseOrdersCsvText(messy)[0];

let failed = false;
function check(ok: boolean, msg: string) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failed = true;
}

check(JSON.stringify(a) === JSON.stringify(b), "messy headers parse identically to canonical");
check(b.orderId === "353094" && b.weightLb === 0.0772, "values land in the right fields");

const cap = parseFlightCapacityCsvText(
  `Departure,Flight Date,Max Totes,Payload (lb),Volume (cuft)\n1,2026-06-04,22,"703",45.83`,
)[0];
check(
  cap.departureId === "1" && cap.availableTotes === 22 && cap.availablePayloadLb === 703 && cap.availableVolumeCuFt === 45.83,
  "capacity csv with renamed headers parses",
);

console.log(failed ? "\nSANITY FAILED" : "\nALL SANITY CHECKS PASSED");
process.exit(failed ? 1 : 0);
