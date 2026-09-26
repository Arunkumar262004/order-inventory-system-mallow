<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Reminder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The header bell: live alerts derived from current data rather than a
 * stored inbox, so they clear themselves once the cause is fixed
 * (product restocked, reminder completed).
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = collect();

        $reminders = $user->reminders()->pending()
            ->where('due_at', '<=', now()->endOfDay())
            ->orderBy('due_at')
            ->get();

        foreach ($reminders as $reminder) {
            /** @var Reminder $reminder */
            $overdue = $reminder->due_at->isPast();
            $items->push([
                'id' => "reminder-{$reminder->id}",
                'type' => $overdue ? 'reminder_overdue' : 'reminder_due',
                'severity' => $overdue ? 'danger' : 'info',
                'title' => $reminder->title,
                'message' => ($overdue ? 'Overdue since ' : 'Due at ').$reminder->due_at->format('d M, h:i A'),
                'link' => '/reminders',
                'at' => $reminder->due_at->toIso8601String(),
            ]);
        }

        if ($user->can('products.view')) {
            $threshold = (int) config('inventory.low_stock_threshold');

            foreach (Product::belowStock($threshold)->orderBy('stock')->orderBy('name')->get() as $product) {
                $out = $product->stock === 0;
                $items->push([
                    'id' => "stock-{$product->id}-{$product->stock}",
                    'type' => $out ? 'out_of_stock' : 'low_stock',
                    'severity' => $out ? 'danger' : 'warning',
                    'title' => $product->name,
                    'message' => $out ? 'Out of stock' : "Only {$product->stock} left (below {$threshold})",
                    'link' => '/inventory?filter=low',
                    'at' => $product->updated_at?->toIso8601String(),
                ]);
            }
        }

        return response()->json(['data' => $items->values(), 'meta' => ['count' => $items->count()]]);
    }
}
