export default function FlightManagementPage() {
  return (
    <div>
      <h1 className="text-xl font-bold">Flight Management</h1>
      <p className="mt-2 text-zinc-400">
        TODO (Person A2 + B, 3D later): assign totes to departures, show weight/space left
        and the binding limit, manifests, and the 3D cabin load view.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-zinc-400">
        <li>Call planFlights from lib/flights.ts (Person A2 implements)</li>
        <li>Stage 2: upload flight_capacity CSV, show rollover between departures</li>
        <li>Manifest per flight: totes → orders → totals (printable)</li>
        <li>3D view with react-three-fiber: totes stacked in the Caravan cabin</li>
        <li>State cabin dimensions + stacking assumptions, with source</li>
      </ul>
    </div>
  );
}
