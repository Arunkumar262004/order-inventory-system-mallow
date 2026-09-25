<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Jobs\SendOrderConfirmation;
use App\Jobs\SendOrderWhatsAppConfirmation;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Support\Money;
use App\Support\Phone;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    /**
     * Place an order: resolve the customer, check and deduct stock, compute
     * totals and persist everything atomically.
     *
     * Concurrency: the product rows are locked with SELECT ... FOR UPDATE
     * inside the transaction, so a competing order for the same product
     * waits until this one commits and then sees the reduced stock.
     *
     * @param  array<int, array{product_id: int, quantity: int}>  $items
     *
     * @throws InsufficientStockException
     * @throws ValidationException
     */
    public function placeOrder(
        string $email,
        ?string $name,
        array $items,
        string|float|null $amountPaid = null,
        ?string $phone = null,
    ): Order {
        $items = array_values($items);

        $order = DB::transaction(function () use ($email, $name, $items, $amountPaid, $phone) {
            $customer = $this->resolveCustomer($email, $name, Phone::normalize($phone));

            // Lock in primary-key order so two orders touching the same
            // products always acquire locks in the same sequence (no deadlocks).
            $products = Product::query()
                ->whereKey(array_column($items, 'product_id'))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $this->ensureStockAvailable($items, $products);

            $lines = $this->buildLines($items, $products);

            $subtotal = array_sum(array_column($lines, 'subtotal_cents'));
            $tax = array_sum(array_column($lines, 'tax_cents'));
            $grandTotal = $subtotal + $tax;

            [$paid, $change] = $this->settlePayment($amountPaid, $grandTotal);

            $order = $customer->orders()->create([
                'order_number' => $this->newOrderNumber(),
                'subtotal' => Money::format($subtotal),
                'tax_total' => Money::format($tax),
                'grand_total' => Money::format($grandTotal),
                'amount_paid' => $paid,
                'change_due' => $change,
            ]);

            $order->items()->createMany(array_map(fn (array $line) => [
                'product_id' => $line['product']->id,
                'unit_price' => $line['product']->price,
                'tax_percent' => $line['product']->tax_percent,
                'quantity' => $line['quantity'],
                'line_subtotal' => Money::format($line['subtotal_cents']),
                'line_tax' => Money::format($line['tax_cents']),
                'line_total' => Money::format($line['subtotal_cents'] + $line['tax_cents']),
            ], $lines));

            foreach ($lines as $line) {
                $line['product']->decrement('stock', $line['quantity']);
            }

            return $order;
        }, attempts: 3);

        $order->load(['customer', 'items.product']);

        // Dispatched only once the transaction has committed, so a rolled-back
        // order can never trigger a confirmation.
        SendOrderConfirmation::dispatch($order);

        if ($order->customer->phone !== null) {
            SendOrderWhatsAppConfirmation::dispatch($order);
        }

        return $order;
    }

    /**
     * Existing customers are matched by email; a name is only needed (and
     * only used) when the customer is new. A supplied mobile number is
     * saved on the customer (new or existing).
     */
    private function resolveCustomer(string $email, ?string $name, ?string $phone): Customer
    {
        $email = mb_strtolower(trim($email));

        if ($phone !== null && Customer::where('phone', $phone)->where('email', '!=', $email)->exists()) {
            throw ValidationException::withMessages([
                'customer_phone' => 'This mobile number belongs to another customer.',
            ]);
        }

        $customer = Customer::query()->where('email', $email)->first();

        if ($customer) {
            if ($phone !== null && $customer->phone !== $phone) {
                $customer->update(['phone' => $phone]);
            }

            return $customer;
        }

        if (blank($name)) {
            throw ValidationException::withMessages([
                'customer_name' => 'A name is required for a new customer.',
            ]);
        }

        // createOrFirst survives a race where two first-time orders for the
        // same email arrive together: the loser re-reads the winner's row.
        return Customer::createOrFirst(['email' => $email], ['name' => trim($name), 'phone' => $phone]);
    }

    /**
     * @param  array<int, array{product_id: int, quantity: int}>  $items
     * @param  Collection<int, Product>  $products
     *
     * @throws InsufficientStockException
     */
    private function ensureStockAvailable(array $items, Collection $products): void
    {
        $shortages = [];

        foreach ($items as $index => $item) {
            $product = $products->get((int) $item['product_id']);
            $available = $product?->stock ?? 0;

            if ($available < (int) $item['quantity']) {
                $shortages[] = [
                    'index' => $index,
                    'product_id' => (int) $item['product_id'],
                    'name' => $product?->name ?? 'Unknown product',
                    'requested' => (int) $item['quantity'],
                    'available' => $available,
                ];
            }
        }

        if ($shortages !== []) {
            throw new InsufficientStockException($shortages);
        }
    }

    /**
     * @param  array<int, array{product_id: int, quantity: int}>  $items
     * @param  Collection<int, Product>  $products
     * @return array<int, array{product: Product, quantity: int, subtotal_cents: int, tax_cents: int}>
     */
    private function buildLines(array $items, Collection $products): array
    {
        return array_map(function (array $item) use ($products) {
            $product = $products->get((int) $item['product_id']);
            $quantity = (int) $item['quantity'];
            $subtotal = Money::toCents($product->price) * $quantity;

            return [
                'product' => $product,
                'quantity' => $quantity,
                'subtotal_cents' => $subtotal,
                'tax_cents' => Money::taxOn($subtotal, $product->tax_percent),
            ];
        }, $items);
    }

    /**
     * @return array{0: ?string, 1: ?string} amount paid and change due
     */
    private function settlePayment(string|float|null $amountPaid, int $grandTotal): array
    {
        if ($amountPaid === null || $amountPaid === '') {
            return [null, null];
        }

        $paid = Money::toCents($amountPaid);

        if ($paid < $grandTotal) {
            throw ValidationException::withMessages([
                'amount_paid' => 'Amount paid ('.Money::format($paid).') is less than the grand total ('.Money::format($grandTotal).').',
            ]);
        }

        return [Money::format($paid), Money::format($paid - $grandTotal)];
    }

    private function newOrderNumber(): string
    {
        return 'ORD-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
