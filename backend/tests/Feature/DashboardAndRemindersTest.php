<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Reminder;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class DashboardAndRemindersTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_summarises_billing_stock_and_reminders(): void
    {
        Queue::fake();
        $user = $this->signIn(['dashboard.view']);
        config(['inventory.low_stock_threshold' => 10]);

        $product = Product::factory()->create(['price' => 100, 'tax_percent' => 0, 'stock' => 50]);
        Product::factory()->create(['stock' => 3]);
        Product::factory()->create(['stock' => 0]);
        app(OrderService::class)->placeOrder('a@example.com', 'A', [['product_id' => $product->id, 'quantity' => 2]]);
        Reminder::factory()->for($user)->create(['title' => 'Mine']);
        Reminder::factory()->create(['title' => 'Someone else']);

        $this->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('billing.today_sales', '200.00')
            ->assertJsonPath('billing.today_orders', 1)
            ->assertJsonCount(7, 'billing.last_7_days')
            ->assertJsonPath('billing.last_7_days.6.total', '200.00')
            ->assertJsonPath('stock.products', 3)
            ->assertJsonPath('stock.low_stock', 1)
            ->assertJsonPath('stock.out_of_stock', 1)
            ->assertJsonCount(1, 'reminders')
            ->assertJsonPath('reminders.0.title', 'Mine');
    }

    public function test_notifications_include_due_reminders_and_stock_alerts_by_permission(): void
    {
        config(['inventory.low_stock_threshold' => 10]);
        Product::factory()->create(['name' => 'Eggs', 'stock' => 0]);
        Product::factory()->create(['name' => 'Rice', 'stock' => 99]);

        $cashier = $this->signIn(['billing.create']);
        Reminder::factory()->for($cashier)->overdue()->create(['title' => 'Late task']);
        Reminder::factory()->for($cashier)->create(['title' => 'Next week', 'due_at' => now()->addWeek()]);
        Reminder::factory()->for($cashier)->overdue()->completed()->create();

        // Cashier: no inventory access, so only their own due reminder.
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.type', 'reminder_overdue');

        $this->signIn(['products.view']);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('meta.count', 1)
            ->assertJsonPath('data.0.type', 'out_of_stock')
            ->assertJsonPath('data.0.title', 'Eggs');
    }

    public function test_reminders_are_private_and_can_be_completed(): void
    {
        $user = $this->signIn([]);

        $id = $this->postJson('/api/reminders', ['title' => 'Order bread', 'due_at' => now()->addHour()->toIso8601String()])
            ->assertCreated()->assertJsonPath('data.is_overdue', false)->json('data.id');

        $this->putJson("/api/reminders/{$id}", ['title' => 'Order bread', 'due_at' => now()->addHour()->toIso8601String(), 'completed' => true])
            ->assertOk();
        $this->assertNotNull(Reminder::find($id)->completed_at);
        $this->getJson('/api/reminders')->assertJsonCount(0, 'data');
        $this->getJson('/api/reminders?status=completed')->assertJsonCount(1, 'data');

        $others = Reminder::factory()->create();
        $this->putJson("/api/reminders/{$others->id}", ['title' => 'x', 'due_at' => now()->toIso8601String()])->assertForbidden();
        $this->deleteJson("/api/reminders/{$others->id}")->assertForbidden();
        $this->assertModelExists($others);
    }
}
