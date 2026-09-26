export default function OrderPickingPage() {
  return (
    <div>
      <h1 className="text-xl font-bold">Order Picking</h1>
      <p className="mt-2 text-zinc-400">
        TODO (Person A1 + B): pack orders into totes, let staff adjust,
        assign totes to carts, print pick lists.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-zinc-400">
        <li>Call packOrdersIntoTotes from lib/packing.ts (Person A1 implements)</li>
        <li>Tote cards: weight, fill %, orders inside; drag orders between totes</li>
        <li>Carts: 5 totes each (configurable), pick list grouped by tote → household</li>
      </ul>
    </div>
  );
}
