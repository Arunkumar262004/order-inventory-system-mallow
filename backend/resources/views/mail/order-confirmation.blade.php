<x-mail::message>
# Thank you, {{ $order->customer->name }}!

Your order **{{ $order->order_number }}** has been confirmed.

<x-mail::table>
| Product | Qty | Unit price | Tax | Line total |
|:--------|:---:|-----------:|----:|-----------:|
@foreach ($order->items as $item)
| {{ $item->product->name }} | {{ $item->quantity }} | ₹{{ $item->unit_price }} | {{ $item->tax_percent }}% | ₹{{ $item->line_total }} |
@endforeach
</x-mail::table>

**Subtotal:** ₹{{ $order->subtotal }}<br>
**Tax:** ₹{{ $order->tax_total }}<br>
**Grand total:** ₹{{ $order->grand_total }}

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
