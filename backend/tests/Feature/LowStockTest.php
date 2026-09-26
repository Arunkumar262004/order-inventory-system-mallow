<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LowStockTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->signIn();

        Product::factory()->create(['name' => 'Eggs', 'stock' => 2]);
        Product::factory()->create(['name' => 'Bread', 'stock' => 4]);
        Product::factory()->create(['name' => 'Milk', 'stock' => 10]);
        Product::factory()->create(['name' => 'Rice', 'stock' => 50]);
    }

    public function test_it_uses_the_configured_threshold_by_default(): void
    {
        config(['inventory.low_stock_threshold' => 10]);

        // "Below" is strict: Milk at exactly 10 is not low.
        $this->getJson('/api/products/low-stock')
            ->assertOk()
            ->assertJsonPath('meta.threshold', 10)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Eggs')
            ->assertJsonPath('data.1.name', 'Bread');
    }

    public function test_threshold_can_be_overridden_per_request(): void
    {
        $this->getJson('/api/products/low-stock?threshold=11')
            ->assertOk()
            ->assertJsonPath('meta.threshold', 11)
            ->assertJsonCount(3, 'data');

        $this->getJson('/api/products/low-stock?threshold=0')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_invalid_threshold_is_rejected(): void
    {
        $this->getJson('/api/products/low-stock?threshold=-1')->assertUnprocessable();
        $this->getJson('/api/products/low-stock?threshold=abc')->assertUnprocessable();
    }
}
