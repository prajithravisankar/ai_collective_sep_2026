export default function OrderEntryPage() {
  return (
    <div>
      <h1 className="text-xl font-bold">Order Entry</h1>
      <p className="mt-2 text-zinc-400">
        TODO (Person B): CSV upload → order list with statuses
        (entered → submitted → picking → picked).
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-zinc-400">
        <li>Use parseOrdersCsv + groupIntoOrders from lib/csv.ts</li>
        <li>Show each household order as a row: id, household, items, weight, status</li>
        <li>Status buttons to move an order forward; persist in localStorage</li>
      </ul>
    </div>
  );
}
