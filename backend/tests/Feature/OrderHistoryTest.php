<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Product;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OrderHistoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->signIn();
    }

    public function test_it_returns_a_customers_orders_newest_first(): void
    {
        Queue::fake();
        $product = Product::factory()->create(['stock' => 100]);
        $service = app(OrderService::class);

        $first = $service->placeOrder('thomas@example.com', 'Thomas', [['product_id' => $product->id, 'quantity' => 1]]);
        $this->travel(1)->minutes();
        $second = $service->placeOrder('thomas@example.com', null, [['product_id' => $product->id, 'quantity' => 2]]);
        $service->placeOrder('someone.else@example.com', 'Else', [['product_id' => $product->id, 'quantity' => 1]]);

        $this->getJson('/api/customers/THOMAS@example.com/orders')
            ->assertOk()
            ->assertJsonPath('customer.email', 'thomas@example.com')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.order_number', $second->order_number)
            ->assertJsonPath('data.1.order_number', $first->order_number)
            ->assertJsonPath('data.0.items.0.quantity', 2)
            ->assertJsonPath('meta.total', 2);
    }

    public function test_a_customer_with_no_orders_gets_an_empty_list(): void
    {
        Customer::factory()->create(['email' => 'new@example.com']);

        $this->getJson('/api/customers/new@example.com/orders')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_unknown_email_returns_404(): void
    {
        $this->getJson('/api/customers/nobody@example.com/orders')->assertNotFound();
    }
}
